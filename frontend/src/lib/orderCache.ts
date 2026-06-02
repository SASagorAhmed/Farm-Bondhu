import type { MarketplaceOrder } from "@/contexts/OrderContext";

function sortOrdersByDateDesc(orders: MarketplaceOrder[]): MarketplaceOrder[] {
  return [...orders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Remove duplicate ids; later entries win (realtime / refetch over stale cache). */
export function dedupeOrdersById(orders: MarketplaceOrder[]): MarketplaceOrder[] {
  const byId = new Map<string, MarketplaceOrder>();
  for (const order of orders) {
    if (order.id) byId.set(order.id, order);
  }
  return sortOrdersByDateDesc([...byId.values()]);
}

/** Upsert incoming orders into existing list, then dedupe and sort by date desc. */
export function mergeOrdersById(
  existing: MarketplaceOrder[],
  incoming: MarketplaceOrder[],
): MarketplaceOrder[] {
  const byId = new Map<string, MarketplaceOrder>();
  for (const order of existing) {
    if (order.id) byId.set(order.id, order);
  }
  for (const order of incoming) {
    if (order.id) byId.set(order.id, order);
  }
  return sortOrdersByDateDesc([...byId.values()]);
}
