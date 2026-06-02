import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { validateOrderInsert, validateOrderCartInput } from "../../lib/orderValidate.js";
import {
  notifyMarketplaceOrderCreated,
  notifyMarketplaceOrderStatusChange,
} from "../../services/marketplaceOrderNotify.js";
import { assertBuyerCanPurchase, ModerationError } from "../../services/adminMarketplaceModeration.js";
import {
  buildOrderQuote,
  placeMarketplaceOrder,
  restockOrderIfNeeded,
  OrderPricingError,
} from "../../services/marketplaceOrderPricing.js";
import { listOrderReviewStatus, ReviewError } from "../../services/marketplaceReviews.js";
import { invalidateMarketplaceProductCache } from "../../lib/marketplaceProductCache.js";

function logNotifyError(err) {
  console.error("[orders] marketplace notify failed:", err?.message || err);
}

const router = Router();
const chain = [requireDatabase, requireUser];

router.get(
  "/",
  ...chain,
  asyncHandler(async (req, res) => {
    const adminRows = await sql`
      select 1 from user_roles where user_id = ${req.userId} and role = 'admin' limit 1
    `;
    const rows = adminRows.length
      ? await sql`select * from orders order by created_at desc limit 500`
      : await sql`
          select * from orders
          where buyer_id = ${req.userId} or seller_id = ${req.userId}
          order by created_at desc
        `;
    res.json({ data: rows });
  })
);

router.post(
  "/preview",
  ...chain,
  asyncHandler(async (req, res) => {
    const validated = validateOrderCartInput(req.body || {});
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }

    try {
      await assertBuyerCanPurchase(req.userId);
    } catch (error) {
      if (error instanceof ModerationError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }

    try {
      const quote = await buildOrderQuote(
        req.userId,
        validated.sellerId,
        validated.items,
        validated.deliveryAddress,
      );
      if (!quote.ok) {
        res.status(400).json({ error: quote.errors.join("; "), data: quote });
        return;
      }
      res.json({ data: quote });
    } catch (error) {
      if (error instanceof OrderPricingError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.post(
  "/",
  ...chain,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const cartValidated = validateOrderCartInput(body);

    if (cartValidated.ok) {
      try {
        await assertBuyerCanPurchase(req.userId);
      } catch (error) {
        if (error instanceof ModerationError) {
          res.status(error.status).json({ error: error.message });
          return;
        }
        throw error;
      }

      try {
        const { order } = await placeMarketplaceOrder(req.userId, {
          seller_id: cartValidated.sellerId,
          items: cartValidated.items,
          delivery_address: cartValidated.deliveryAddress ?? body.delivery_address,
          payment_method: cartValidated.paymentMethod ?? body.payment_method,
          buyer_name: cartValidated.buyerName ?? body.buyer_name,
          seller_name: cartValidated.sellerName ?? body.seller_name,
          estimated_delivery_note: cartValidated.estimatedDeliveryNote ?? body.estimated_delivery_note,
        });
        const productIds = (Array.isArray(order.items) ? order.items : [])
          .map((item) => item?.productId || item?.product_id)
          .filter(Boolean);
        invalidateMarketplaceProductCache(String(order.seller_id || cartValidated.sellerId), productIds);
        void notifyMarketplaceOrderCreated(order).catch(logNotifyError);
        res.status(201).json({ data: order });
        return;
      } catch (error) {
        if (error instanceof OrderPricingError) {
          res.status(error.status).json({ error: error.message });
          return;
        }
        throw error;
      }
    }

    const validated = validateOrderInsert(body);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }

    try {
      await assertBuyerCanPurchase(req.userId);
    } catch (error) {
      if (error instanceof ModerationError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }

    res.status(400).json({
      error: cartValidated.error || "Order items must include productId, qty, and priceTier",
    });
  })
);

const updateKeys = [
  "buyer_name",
  "seller_name",
  "items",
  "total",
  "shipping_fee",
  "delivery_address",
  "payment_method",
  "payment_status",
  "timeline",
  "estimated_delivery",
  "estimated_delivery_note",
  "status",
  "date",
  "return_reason",
  "return_note",
  "tracking_id",
];

router.patch(
  "/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const patch = {};
    for (const k of updateKeys) {
      if (b[k] !== undefined) patch[k] = b[k];
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No updatable fields" });
      return;
    }
    const [existing] = await sql`
      select * from orders where id = ${req.params.id} limit 1
    `;
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const adminRows = await sql`
      select 1 from user_roles where user_id = ${req.userId} and role = 'admin' limit 1
    `;
    const allowed =
      adminRows.length ||
      existing.buyer_id === req.userId ||
      existing.seller_id === req.userId;
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [updated] = await sql`
      update orders set ${sql(patch)} where id = ${req.params.id} returning *
    `;

    const prevStatus = String(existing.status || "");
    const nextStatus = String(updated.status || "");
    if (prevStatus !== nextStatus && ["cancelled", "returned", "refunded"].includes(nextStatus)) {
      try {
        const restored = await restockOrderIfNeeded(updated);
        if (restored) {
          const productIds = (Array.isArray(updated.items) ? updated.items : [])
            .map((item) => item?.productId || item?.product_id)
            .filter(Boolean);
          invalidateMarketplaceProductCache(String(updated.seller_id || ""), productIds);
        }
      } catch (err) {
        console.error("[orders] restock failed:", err?.message || err);
      }
    }

    void notifyMarketplaceOrderStatusChange(existing, updated).catch(logNotifyError);
    res.json({ data: updated });
  })
);

/** Admin-only: list many orders (same as GET with admin, kept for explicit client path). */
router.get(
  "/admin/all",
  requireDatabase,
  requireUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      select * from orders order by created_at desc limit 500
    `;
    res.json({ data: rows });
  })
);

router.get(
  "/:orderId/review-status",
  ...chain,
  asyncHandler(async (req, res) => {
    try {
      const data = await listOrderReviewStatus(req.params.orderId, req.userId);
      res.json({ data });
    } catch (error) {
      if (error instanceof ReviewError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

export default router;
