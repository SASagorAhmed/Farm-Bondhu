import { API_BASE, readSession } from "@/api/client";
import type { SavedUserAddress, UserAddressFormValues } from "@/lib/bangladeshLocations";
import { mapSavedAddress } from "@/lib/bangladeshLocations";

export async function fetchUserAddresses(): Promise<SavedUserAddress[]> {
  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}/v1/me/addresses`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>[]; error?: string };
  if (!res.ok) throw new Error(body.error || "Failed to load addresses");
  return (body.data || []).map((row) => mapSavedAddress(row));
}

export async function createUserAddress(payload: Record<string, unknown>): Promise<SavedUserAddress> {
  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}/v1/me/addresses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: string };
  if (!res.ok) throw new Error(body.error || "Failed to save address");
  return mapSavedAddress(body.data!);
}

export async function updateUserAddress(id: string, payload: Record<string, unknown>): Promise<SavedUserAddress> {
  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}/v1/me/addresses/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: string };
  if (!res.ok) throw new Error(body.error || "Failed to update address");
  return mapSavedAddress(body.data!);
}

export async function deleteUserAddress(id: string): Promise<void> {
  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}/v1/me/addresses/${id}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "Failed to delete address");
  }
}

export async function setDefaultUserAddress(id: string): Promise<SavedUserAddress> {
  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}/v1/me/addresses/${id}/default`, {
    method: "PATCH",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: string };
  if (!res.ok) throw new Error(body.error || "Failed to set default address");
  return mapSavedAddress(body.data!);
}

export function savedAddressToDeliveryAddress(addr: SavedUserAddress, note?: string) {
  return {
    recipientName: addr.fullName,
    phone: addr.phone,
    altPhone: addr.altPhone || undefined,
    country: addr.country,
    division: addr.division,
    district: addr.district,
    upazila: addr.upazila,
    area: addr.area,
    address: addr.fullAddress,
    landmark: addr.landmark || undefined,
    postCode: addr.postCode || undefined,
    addressType: addr.addressType,
    city: addr.district,
    note,
  };
}

export function payloadToDeliveryAddress(
  payload: {
    full_name: string;
    phone: string;
    alt_phone?: string | null;
    country: string;
    division: string;
    district: string;
    upazila: string;
    area?: string | null;
    full_address: string;
    landmark?: string | null;
    post_code?: string | null;
    address_type: string;
  },
  note?: string
) {
  return {
    recipientName: payload.full_name,
    phone: payload.phone,
    altPhone: payload.alt_phone || undefined,
    country: payload.country,
    division: payload.division,
    district: payload.district,
    upazila: payload.upazila,
    area: payload.area || "",
    address: payload.full_address,
    landmark: payload.landmark || undefined,
    postCode: payload.post_code || undefined,
    addressType: payload.address_type,
    city: payload.district,
    note,
  };
}

export type { UserAddressFormValues };
