import type { DeliveryAddress } from "@/contexts/OrderContext";

export function parseDeliveryAddress(raw: unknown): DeliveryAddress {
  if (!raw) {
    return {
      recipientName: "",
      phone: "",
      area: "",
      address: "",
      city: "",
    };
  }

  let value: Record<string, unknown> = {};
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { recipientName: "", phone: "", area: "", address: "", city: "" };
    }
    try {
      value = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return {
        recipientName: "",
        phone: "",
        area: "",
        address: trimmed,
        city: "",
      };
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    value = raw as Record<string, unknown>;
  }

  return {
    recipientName: String(value.recipientName || value.recipient_name || ""),
    phone: String(value.phone || ""),
    altPhone: value.altPhone || value.alt_phone ? String(value.altPhone || value.alt_phone) : undefined,
    country: value.country ? String(value.country) : undefined,
    division: value.division ? String(value.division) : undefined,
    district: value.district ? String(value.district) : undefined,
    upazila: value.upazila ? String(value.upazila) : undefined,
    area: String(value.area || ""),
    address: String(value.address || value.full_address || ""),
    landmark: value.landmark ? String(value.landmark) : undefined,
    postCode: value.postCode || value.post_code ? String(value.postCode || value.post_code) : undefined,
    addressType: value.addressType || value.address_type ? String(value.addressType || value.address_type) : undefined,
    city: String(value.city || value.district || ""),
    note: value.note ? String(value.note) : undefined,
  };
}

export function normalizeDeliveryAddressForDb(address: DeliveryAddress): DeliveryAddress {
  return {
    recipientName: address.recipientName.trim(),
    phone: address.phone.trim(),
    altPhone: address.altPhone?.trim() || undefined,
    country: address.country || "Bangladesh",
    division: address.division?.trim() || undefined,
    district: address.district?.trim() || address.city?.trim() || undefined,
    upazila: address.upazila?.trim() || undefined,
    area: address.area?.trim() || "",
    address: address.address.trim(),
    landmark: address.landmark?.trim() || undefined,
    postCode: address.postCode?.trim() || undefined,
    addressType: address.addressType || undefined,
    city: address.city?.trim() || address.district?.trim() || "",
    note: address.note?.trim() || undefined,
  };
}
