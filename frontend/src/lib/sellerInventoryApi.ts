import { useQuery } from "@tanstack/react-query";
import { apiJson, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SellerInventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  stock: number;
  units_sold: number;
  units_delivered: number;
  listing_status?: string | null;
  image?: string | null;
  seller_id?: string;
  [key: string]: unknown;
}

export function sellerInventoryQueryKey(userId?: string) {
  return ["seller-inventory", userId || "anonymous"] as const;
}

export async function fetchSellerInventory(): Promise<SellerInventoryItem[]> {
  const token = readSession()?.access_token;
  const { res, body } = await apiJson("/v1/marketplace/seller/inventory", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(String((body as { error?: string }).error || "Could not load inventory"));
  }
  return ((body as { data?: SellerInventoryItem[] }).data || []) as SellerInventoryItem[];
}

export function useSellerInventory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: sellerInventoryQueryKey(user?.id),
    enabled: Boolean(user?.id),
    queryFn: fetchSellerInventory,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function invalidateSellerInventoryQueries(
  queryClient: { invalidateQueries: (opts: { queryKey: readonly string[] }) => Promise<unknown> },
  userId?: string,
) {
  void queryClient.invalidateQueries({ queryKey: sellerInventoryQueryKey(userId) });
}
