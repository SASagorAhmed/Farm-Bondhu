import { apiJson, readSession } from "@/api/client";
import type { DeliveryAddress } from "@/contexts/OrderContext";
import type { OrderPreviewQuote, PriceTier } from "@/lib/wholesalePricing";
import { normalizeDeliveryAddressForDb } from "@/lib/deliveryAddress";

export interface PreviewCartLine {
  productId: string;
  qty: number;
  priceTier: PriceTier;
}

export async function previewOrderQuote(params: {
  sellerId: string;
  items: PreviewCartLine[];
  deliveryAddress?: DeliveryAddress | null;
}): Promise<OrderPreviewQuote> {
  const token = readSession()?.access_token;
  const body: Record<string, unknown> = {
    seller_id: params.sellerId,
    items: params.items.map((i) => ({
      productId: i.productId,
      qty: i.qty,
      priceTier: i.priceTier,
    })),
  };
  if (params.deliveryAddress) {
    body.delivery_address = normalizeDeliveryAddressForDb(params.deliveryAddress);
  }

  const { res, body: responseBody } = await apiJson("/v1/orders/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = (responseBody as { data?: OrderPreviewQuote; error?: string }).data;
  if (!res.ok) {
    return {
      ok: false,
      errors: [String((responseBody as { error?: string }).error || "Could not preview order")],
      ...(data || {}),
    };
  }
  return data || { ok: false, errors: ["Empty preview response"] };
}

export async function placeServerOrder(params: {
  sellerId: string;
  sellerName: string;
  buyerName: string;
  items: PreviewCartLine[];
  deliveryAddress: DeliveryAddress;
  paymentMethod: string;
}) {
  const token = readSession()?.access_token;
  const { res, body } = await apiJson("/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      seller_id: params.sellerId,
      seller_name: params.sellerName,
      buyer_name: params.buyerName,
      items: params.items.map((i) => ({
        productId: i.productId,
        qty: i.qty,
        priceTier: i.priceTier,
      })),
      delivery_address: normalizeDeliveryAddressForDb(params.deliveryAddress),
      payment_method: params.paymentMethod,
      estimated_delivery_note: "3-5 business days",
    }),
  });

  if (!res.ok) {
    throw new Error(String((body as { error?: string }).error || "Failed to place order"));
  }
  return (body as { data?: Record<string, unknown> }).data;
}
