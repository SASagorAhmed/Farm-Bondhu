import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CartItem } from "@/contexts/CartContext";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";

export type OrderStatus = "pending" | "confirmed" | "packed" | "shipped" | "out_for_delivery" | "delivered" | "cancelled" | "return_requested" | "returned" | "refunded";

export interface DeliveryAddress {
  recipientName: string;
  phone: string;
  address: string;
  area: string;
  city: string;
  note?: string;
}

export interface OrderTimeline {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface MarketplaceOrder {
  id: string;
  date: string;
  items: { productId: string; name: string; qty: number; price: number; image: string }[];
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

function dbToOrder(row: any): MarketplaceOrder {
  return {
    id: row.id,
    date: row.date,
    items: (row.items as any[]) || [],
    total: Number(row.total),
    shippingFee: Number(row.shipping_fee),
    status: row.status as OrderStatus,
    buyerId: row.buyer_id,
    buyerName: row.buyer_name,
    sellerId: row.seller_id,
    sellerName: row.seller_name,
    deliveryAddress: row.delivery_address as DeliveryAddress,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status as "unpaid" | "paid" | "refunded",
    timeline: (row.timeline as any[]) || [],
    returnReason: row.return_reason,
    returnNote: row.return_note,
    estimatedDelivery: row.estimated_delivery,
    trackingId: row.tracking_id,
  };
}

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await api.from("orders").select("*").order("created_at", { ascending: false });
      if (data) setOrders(data.map(dbToOrder));
    };
    load();
  }, [user]);

  const placeOrder = useCallback(async (params: {
    items: CartItem[];
    deliveryAddress: DeliveryAddress;
    paymentMethod: string;
    buyerId: string;
    buyerName: string;
  }): Promise<MarketplaceOrder> => {
    const sellerGroups = new Map<string, CartItem[]>();
    params.items.forEach(item => {
      const existing = sellerGroups.get(item.product.sellerId) || [];
      existing.push(item);
      sellerGroups.set(item.product.sellerId, existing);
    });

    const newOrders: MarketplaceOrder[] = [];

    for (const [sellerId, items] of sellerGroups) {
      const total = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
      const hasFreeDelivery = items.some(i => i.product.freeDelivery);
      const shippingFee = hasFreeDelivery ? 0 : 60;
      const now = new Date().toISOString();

      const orderItems = items.map(i => ({
        productId: i.product.id,
        name: i.product.name,
        qty: i.quantity,
        price: i.product.price,
        image: i.product.image,
      }));

      const timeline = [{ status: "pending", timestamp: now, note: "Order placed successfully" }];

      const { data, error } = await api.from("orders").insert({
        buyer_id: params.buyerId,
        buyer_name: params.buyerName,
        seller_id: sellerId,
        seller_name: items[0].product.seller,
        items: orderItems as any,
        total: total + shippingFee,
        shipping_fee: shippingFee,
        delivery_address: params.deliveryAddress as any,
        payment_method: params.paymentMethod,
        payment_status: params.paymentMethod === "cash_on_delivery" ? "unpaid" : "paid",
        timeline: timeline as any,
        estimated_delivery: "3-5 business days",
        status: "pending",
      }).select().single();

      if (data) newOrders.push(dbToOrder(data));
    }

    setOrders(prev => [...newOrders, ...prev]);
    return newOrders[0];
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus, note?: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const newTimeline = [...order.timeline, { status, timestamp: new Date().toISOString(), note: note || `Status updated to ${status}` }];
    const trackingId = (status === "shipped" && !order.trackingId) ? `FB${orderId.slice(0, 6).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}` : order.trackingId;
    const paymentStatus = status === "delivered" && order.paymentMethod === "cash_on_delivery" ? "paid" : order.paymentStatus;

    await api.from("orders").update({
      status, timeline: newTimeline as any, tracking_id: trackingId, payment_status: paymentStatus,
    }).eq("id", orderId);

    setOrders(prev => prev.map(o => o.id !== orderId ? o : { ...o, status, timeline: newTimeline, trackingId, paymentStatus }));
  }, [orders]);

  const requestReturn = useCallback(async (orderId: string, reason: string, note?: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const newTimeline = [...order.timeline, { status: "return_requested" as OrderStatus, timestamp: new Date().toISOString(), note: `Return requested: ${reason}` }];
    await api.from("orders").update({
      status: "return_requested", return_reason: reason, return_note: note, timeline: newTimeline as any,
    }).eq("id", orderId);
    setOrders(prev => prev.map(o => o.id !== orderId ? o : { ...o, status: "return_requested" as OrderStatus, returnReason: reason, returnNote: note, timeline: newTimeline }));
  }, [orders]);

  const cancelOrder = useCallback(async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || !["pending", "confirmed"].includes(order.status)) return;
    const newTimeline = [...order.timeline, { status: "cancelled" as OrderStatus, timestamp: new Date().toISOString(), note: "Order cancelled by buyer" }];
    await api.from("orders").update({ status: "cancelled", timeline: newTimeline as any }).eq("id", orderId);
    setOrders(prev => prev.map(o => o.id !== orderId ? o : { ...o, status: "cancelled" as OrderStatus, timeline: newTimeline }));
  }, [orders]);

  const getOrdersByBuyer = useCallback((buyerId: string) => orders.filter(o => o.buyerId === buyerId), [orders]);
  const getOrdersBySeller = useCallback((sellerId: string) => orders.filter(o => o.sellerId === sellerId), [orders]);
  const getOrder = useCallback((orderId: string) => orders.find(o => o.id === orderId), [orders]);

  return (
    <OrderContext.Provider value={{ orders, placeOrder, updateOrderStatus, requestReturn, cancelOrder, getOrdersByBuyer, getOrdersBySeller, getOrder }}>
      {children}
    </OrderContext.Provider>
  );
}
