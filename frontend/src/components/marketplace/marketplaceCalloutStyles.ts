import type { CSSProperties } from "react";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";

export const marketplaceInlineNoticeBox =
  "mx-3 mt-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs leading-snug";

export const marketplaceInlineNoticeText = "text-muted-foreground";

export const marketplaceInlineNoticeCountdown =
  "mt-1 text-[10px] tabular-nums text-muted-foreground/80";

export const marketplaceInlineNoticeAccentStyle: CSSProperties = {
  borderLeftWidth: 3,
  borderLeftColor: MARKETPLACE_THEME.primary,
};

/** Lane + category filter tab tray (Marketplace browse). */
export const marketplaceFilterTabsListClass =
  "inline-flex items-center justify-center rounded-md p-1 border text-muted-foreground";

export const marketplaceFilterTabsListStyle: CSSProperties = {
  backgroundColor: `${MARKETPLACE_THEME.primary}12`,
  borderColor: `${MARKETPLACE_THEME.primary}33`,
};

/** Inactive pink text; active solid marketplace primary pill. Hex matches MARKETPLACE_THEME. */
export const marketplaceFilterTabsTriggerClass =
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-[#DB2777] hover:text-[#E91E8C] data-[state=active]:bg-[#E91E8C] data-[state=active]:text-white data-[state=active]:shadow-sm";

/** Sub-row category chips: default tray; black labels; pink pill when selected. */
export const marketplaceCategoryFilterTabsTriggerClass =
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-foreground hover:text-foreground data-[state=active]:bg-[#E91E8C] data-[state=active]:text-white data-[state=active]:shadow-sm";

/** Category browse tile icon container (buyer home + categories page). */
export const marketplaceCategoryIconBoxStyle: CSSProperties = {
  backgroundColor: `${MARKETPLACE_THEME.primary}15`,
};

export const marketplaceCategoryIconColor = MARKETPLACE_THEME.primary;

export const marketplaceCategoryCardAccentStyle: CSSProperties = {
  background: MARKETPLACE_THEME.primary,
};
