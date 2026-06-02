import React, { createContext, useContext, useCallback, useEffect } from "react";
import { CartItem } from "@/contexts/CartContext";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseDeliveryAddress } from "@/lib/deliveryAddress";
import { placeServerOrder } from "@/lib/orderPreviewApi";
import { invalidateMarketplaceStockQueries } from "@/lib/marketplaceStockQueries";
import { queryKeys } from "@/lib/queryClient";
import { dedupeOrdersById, mergeOrdersById } from "@/lib/orderCache";

export type OrderStatus = "pending" | "confirmed" | "packed" | "shipped" | "out_for_delivery" | "delivered" | "cancelled" | "return_requested" | "returned" | "refunded";

export interface DeliveryAddress {
  recipientName: string;
  phone: string;
  altPhone?: string;
  country?: string;
  division?: string;
  district?: string;
  upazila?: string;
  area: string;
  address: string;
  landmark?: string;
  postCode?: string;
  addressType?: string;
  city: string;
  note?: string;
}

export function formatDeliveryAddressLines(addr: DeliveryAddress): string[] {
  if (addr.division || addr.district || addr.upazila) {
    const lines: string[] = [];
    const geo = [addr.area, addr.upazila, addr.district, addr.division].filter(Boolean).join(", ");
    if (geo) lines.push(geo);
    if (addr.address) lines.push(addr.address);
    if (addr.landmark) lines.push(`Landmark: ${addr.landmark}`);
    return lines;
  }
  return [[addr.address, addr.area, addr.city].filter(Boolean).join(", ")].filter(Boolean);
}

export interface OrderTimeline {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface MarketplaceOrderItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  unitPrice?: number;
  lineTotal?: number;
  priceTier?: "retail" | "wholesale";
  retailUnitPrice?: number;
  wholesaleRule?: string;
  image: string;
}

export interface MarketplaceOrder {
  id: string;
  date: string;
  items: MarketplaceOrderItem[];
  total: number;
  shippingFee: number;
  status: OrderStatus;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  deliveryAddress: DeliveryAddress;
  paymentMethod: string;
  paymentStatus: "unpaid" | "paid" | "refunded";
  timeline: OrderTimeline[];
  returnReason?: string;
  returnNote?: string;
  estimatedDelivery?: string;
  trackingId?: string;
}

interface OrderContextType {
  orders: MarketplaceOrder[];
  placeOrder: (params: {
    items: CartItem[];
    deliveryAddress: DeliveryAddress;
    paymentMethod: string;
    buyerId: string;
    buyerName: string;
  }) => Promise<MarketplaceOrder>;
  updateOrderStatus: (orderId: string, status: OrderStatus, note?: string) => void;
  requestReturn: (orderId: string, reason: string, note?: string) => void;
  cancelOrder: (orderId: string) => void;
  getOrdersByBuyer: (buyerId: string) => MarketplaceOrder[];
  getOrdersBySeller: (sellerId: string) => MarketplaceOrder[];
  getOrder: (orderId: string) => MarketplaceOrder | undefined;
}

const OrderContext = createContext<OrderContextType | null>(null);

export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrders must be used within OrderProvider");
  return ctx;
}

function normalizeOrderItem(raw: Record<string, unknown>): MarketplaceOrderItem {
  const unitPrice = Number(raw.unitPrice ?? raw.price ?? 0);
  return {
    productId: String(raw.productId || raw.product_id || ""),
    name: String(raw.name || ""),
    qty: Number(raw.qty ?? raw.quantity ?? 0),
    price: unitPrice,
    unitPrice,
    lineTotal: raw.lineTotal != null ? Number(raw.lineTotal) : undefined,
    priceTier: raw.priceTier === "wholesale" ? "wholesale" : "retail",
    retailUnitPrice: raw.retailUnitPrice != null ? Number(raw.retailUnitPrice) : undefined,
    wholesaleRule: raw.wholesaleRule != null ? String(raw.wholesaleRule) : undefined,
    image: String(raw.image || ""),
  };
}

function dbToOrder(row: any): MarketplaceOrder {
  const rawItems = Array.isArray(row.items) ? row.items : [];
  return {
    id: row.id,
    date: row.date,
    items: rawItems.map((item: Record<string, unknown>) => normalizeOrderItem(item)),
    total: Number(row.total),
    shippingFee: Number(row.shipping_fee),
    status: row.status as OrderStatus,
    buyerId: row.buyer_id,
    buyerName: row.buyer_name,
    sellerId: row.seller_id,
    sellerName: row.seller_name,
    deliveryAddress: parseDeliveryAddress(row.delivery_address),
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status as "unpaid" | "paid" | "refunded",
    timeline: (row.timeline as any[]) || [],
    returnReason: row.return_reason,
    returnNote: row.return_note,
    estimatedDelivery: row.estimated_delivery_note || row.estimated_delivery,
    trackingId: row.tracking_id,
  };
}

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: orders = [] } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data } = await api.from("orders").select("*").order("created_at", { ascending: false });
      return dedupeOrdersById((data || []).map(dbToOrder));
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = api
      .channel(`orders-live-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload: any) => {
        const eventType = String(payload?.eventType || "").toUpperCase();
        if ((eventType === "INSERT" || eventType === "UPDATE") && payload?.new) {
          const row = dbToOrder(payload.new);
          if (row.buyerId !== user.id && row.sellerId !== user.id) return;
          queryClient.setQueryData<MarketplaceOrder[]>(["orders", user.id], (prev = []) =>
            mergeOrdersById(prev, [row])
          );
          return;
        }
        if (eventType === "DELETE" && payload?.old?.id) {
          queryClient.setQueryData<MarketplaceOrder[]>(["orders", user.id], (prev = []) =>
            prev.filter((o) => o.id !== payload.old.id)
          );
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["orders", user.id] });
      })
      .subscribe();
    return () => {
      api.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  const placeOrder = useCallback(async (params: {
    items: CartItem[];
    deliveryAddress: DeliveryAddress;
    paymentMethod: string;
    buyerId: string;
    buyerName: string;
  }): Promise<MarketplaceOrder> => {
    const sellerGroups = new Map<string, CartItem[]>();
    params.items.forEach((item) => {
      const existing = sellerGroups.get(item.product.sellerId) || [];
      existing.push(item);
      sellerGroups.set(item.product.sellerId, existing);
    });

    const newOrders: MarketplaceOrder[] = [];

    for (const [sellerId, sellerItems] of sellerGroups) {
      const data = await placeServerOrder({
        sellerId,
        sellerName: sellerItems[0].product.seller,
        buyerName: params.buyerName,
        items: sellerItems.map((i) => ({
          productId: i.product.id,
          qty: i.quantity,
          priceTier: i.priceTier,
        })),
        deliveryAddress: params.deliveryAddress,
        paymentMethod: params.paymentMethod,
      });

      if (!data) throw new Error("Failed to place order");
      newOrders.push(dbToOrder(data));
    }

    if (!newOrders.length) {
      throw new Error("No orders were created");
    }

    await queryClient.invalidateQueries({ queryKey: ["orders", user?.id] });
    const productIds = params.items.map((i) => i.product.id);
    const sellerIds = [...new Set(params.items.map((i) => i.product.sellerId))];
    invalidateMarketplaceStockQueries(queryClient, { userId: user?.id, productIds });
    for (const sellerId of sellerIds) {
      invalidateMarketplaceStockQueries(queryClient, { userId: sellerId, productIds });
    }
    return newOrders[0];
  }, [queryClient, user?.id]);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus, note?: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const newTimeline = [...order.timeline, { status, timestamp: new Date().toISOString(), note: note || `Status updated to ${status}` }];
    const trackingId = (status === "shipped" && !order.trackingId) ? `FB${orderId.slice(0, 6).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}` : order.trackingId;
    const paymentStatus = status === "delivered" && order.paymentMethod === "cash_on_delivery" ? "paid" : order.paymentStatus;

    await api.from("orders").update({
      status, timeline: newTimeline as any, tracking_id: trackingId, payment_status: paymentStatus,
    }).eq("id", orderId);

    queryClient.setQueryData<MarketplaceOrder[]>(
      ["orders", user?.id],
      (prev = []) => prev.map((o) => (o.id !== orderId ? o : { ...o, status, timeline: newTimeline, trackingId, paymentStatus }))
    );
    if (status === "delivered") {
      void queryClient.invalidateQueries({ queryKey: queryKeys().sellerEarnings(order.sellerId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys().sellerEarningsBreakdown(order.sellerId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys().sellerWithdrawals(order.sellerId) });
    }
    if (["cancelled", "returned", "refunded"].includes(status)) {
      invalidateMarketplaceStockQueries(queryClient, { userId: user?.id });
      invalidateMarketplaceStockQueries(queryClient, { userId: order.sellerId });
    }
  }, [orders, queryClient, user?.id]);

  const requestReturn = useCallback(async (orderId: string, reason: string, note?: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const newTimeline = [...order.timeline, { status: "return_requested" as OrderStatus, timestamp: new Date().toISOString(), note: `Return requested: ${reason}` }];
    await api.from("orders").update({
      status: "return_requested", return_reason: reason, return_note: note, timeline: newTimeline as any,
    }).eq("id", orderId);
    queryClient.setQueryData<MarketplaceOrder[]>(
      ["orders", user?.id],
      (prev = []) => prev.map((o) => (o.id !== orderId ? o : { ...o, status: "return_requested" as OrderStatus, returnReason: reason, returnNote: note, timeline: newTimeline }))
    );
  }, [orders, queryClient, user?.id]);

  const cancelOrder = useCallback(async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || !["pending", "confirmed"].includes(order.status)) return;
    const newTimeline = [...order.timeline, { status: "cancelled" as OrderStatus, timestamp: new Date().toISOString(), note: "Order cancelled by buyer" }];
    await api.from("orders").update({ status: "cancelled", timeline: newTimeline as any }).eq("id", orderId);
    queryClient.setQueryData<MarketplaceOrder[]>(
      ["orders", user?.id],
      (prev = []) => prev.map((o) => (o.id !== orderId ? o : { ...o, status: "cancelled" as OrderStatus, timeline: newTimeline }))
    );
    invalidateMarketplaceStockQueries(queryClient, { userId: user?.id });
    invalidateMarketplaceStockQueries(queryClient, { userId: order.sellerId });
  }, [orders, queryClient, user?.id]);

  const getOrdersByBuyer = useCallback((buyerId: string) => orders.filter(o => o.buyerId === buyerId), [orders]);
  const getOrdersBySeller = useCallback((sellerId: string) => orders.filter(o => o.sellerId === sellerId), [orders]);
  const getOrder = useCallback((orderId: string) => orders.find(o => o.id === orderId), [orders]);

  return (
    <OrderContext.Provider value={{ orders, placeOrder, updateOrderStatus, requestReturn, cancelOrder, getOrdersByBuyer, getOrdersBySeller, getOrder }}>
      {children}
    </OrderContext.Provider>
  );
}
