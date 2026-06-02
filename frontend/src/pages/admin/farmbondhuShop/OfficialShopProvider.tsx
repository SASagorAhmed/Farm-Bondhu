import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import {
  fetchOfficialFarmBondhuShopMeta,
  type OfficialFarmBondhuShopMeta,
} from "@/lib/adminMarketplaceApi";
import { ICON_COLORS } from "@/lib/iconColors";

type OfficialShopContextValue = {
  meta: OfficialFarmBondhuShopMeta;
  sellerId: string;
  shopName: string;
};

const OfficialShopContext = createContext<OfficialShopContextValue | null>(null);

export function useOfficialShop() {
  const ctx = useContext(OfficialShopContext);
  if (!ctx) {
    throw new Error("useOfficialShop must be used within OfficialShopProvider");
  }
  return ctx;
}

export default function OfficialShopProvider({ children }: { children: ReactNode }) {
  const { data: meta, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys().officialShopMeta(),
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: fetchOfficialFarmBondhuShopMeta,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: ICON_COLORS.farm }} />
        <p>Loading official shop…</p>
      </div>
    );
  }

  if (isError || !meta?.seller_id) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center max-w-lg mx-auto mt-12">
        <ShieldCheck className="h-10 w-10 mx-auto mb-3" style={{ color: ICON_COLORS.farm }} />
        <h2 className="text-lg font-display font-semibold text-foreground">Official shop not configured</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Add a FarmBondhu product or set OFFICIAL_SUPER_ADMIN_EMAIL so the platform shop seller can be resolved.
        </p>
        <button
          type="button"
          className="mt-4 text-sm font-medium underline text-foreground"
          onClick={() => refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <OfficialShopContext.Provider
      value={{
        meta,
        sellerId: meta.seller_id,
        shopName: meta.shop_name || "FarmBondhu",
      }}
    >
      {children}
    </OfficialShopContext.Provider>
  );
}
