import { CheckCircle2, Package, Truck, Clock, type LucideIcon } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import type { OrderStatus } from "@/contexts/OrderContext";
import { VENDOR_THEME } from "@/lib/vendorTheme";

export const SELLER_ORDER_STATUS_STEPS: {
  status: OrderStatus;
  label: string;
  icon: LucideIcon;
}[] = [
  { status: "pending", label: "Order Placed", icon: Clock },
  { status: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { status: "packed", label: "Packed", icon: Package },
  { status: "shipped", label: "Shipped", icon: Truck },
  { status: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { status: "delivered", label: "Delivered", icon: CheckCircle2 },
];

export const sellerOrderStatusColors: Record<string, string> = {
  pending: ICON_COLORS.finance,
  confirmed: VENDOR_THEME.primary,
  packed: VENDOR_THEME.primary,
  shipped: VENDOR_THEME.primary,
  out_for_delivery: ICON_COLORS.farm,
  delivered: ICON_COLORS.farm,
  cancelled: ICON_COLORS.health,
  return_requested: ICON_COLORS.finance,
  returned: ICON_COLORS.health,
  refunded: ICON_COLORS.finance,
};

export const sellerOrderNextActions: Record<
  string,
  { label: string; nextStatus: OrderStatus; note: string; icon: LucideIcon }
> = {
  pending: {
    label: "Confirm Order",
    nextStatus: "confirmed",
    note: "Seller confirmed the order",
    icon: CheckCircle2,
  },
  confirmed: {
    label: "Mark as Packed",
    nextStatus: "packed",
    note: "Product packed and ready for pickup",
    icon: Package,
  },
  packed: {
    label: "Handover to Logistics",
    nextStatus: "shipped",
    note: "Parcel handed to delivery partner",
    icon: Truck,
  },
  shipped: {
    label: "Mark Out for Delivery",
    nextStatus: "out_for_delivery",
    note: "Parcel out for final delivery",
    icon: Truck,
  },
  out_for_delivery: {
    label: "Mark Delivered",
    nextStatus: "delivered",
    note: "Product delivered to customer",
    icon: CheckCircle2,
  },
  return_requested: {
    label: "Accept Return",
    nextStatus: "returned" as OrderStatus,
    note: "Return accepted and processed",
    icon: CheckCircle2,
  },
};
