import { api } from "@/api/client";
import type { SalesMemoDraft, SalesMemoLine } from "@/lib/salesMemoPdf";

export type SalesMemoFormSnapshot = {
  memoNo: string;
  memoDate: string;
  farmName: string;
  farmType: string;
  farmLocation: string;
  sellerPhone: string;
  sellerEmail: string;
  buyerName: string;
  footerNote: string;
  selectedIds: string[];
  customItems: SalesMemoLine[];
};

export type SavedSalesMemo = {
  id: string;
  memo_no: string;
  memo_date: string;
  buyer_name: string | null;
  grand_total: number;
  draft: SalesMemoFormSnapshot;
  created_at: string;
  updated_at: string;
};

export type SaleRecordRow = {
  id: string;
  date: string;
  product: string;
  category: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  buyer: string;
};

function normalizeMemoLine(raw: unknown): SalesMemoLine | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const product = String(o.product || "").trim();
  if (!product) return null;
  const quantity = Number(o.quantity) || 0;
  const unitPrice = Number(o.unitPrice ?? o.unit_price) || 0;
  let lineTotal = Number(o.lineTotal ?? o.line_total) || 0;
  if (!lineTotal && quantity > 0 && unitPrice > 0) {
    lineTotal = Math.round(quantity * unitPrice);
  }
  return {
    id: String(o.id || `custom-${crypto.randomUUID()}`),
    date: String(o.date || ""),
    product,
    category: String(o.category || "eggs"),
    quantity,
    unit: String(o.unit || "pieces"),
    unitPrice,
    lineTotal,
  };
}

function parseDraft(raw: unknown): SalesMemoFormSnapshot {
  const d = (raw && typeof raw === "object" ? raw : {}) as Partial<SalesMemoFormSnapshot>;
  const rawCustom = Array.isArray(d.customItems) ? d.customItems : [];
  const customItems = rawCustom
    .map(normalizeMemoLine)
    .filter((line): line is SalesMemoLine => line !== null);
  return {
    memoNo: String(d.memoNo || ""),
    memoDate: String(d.memoDate || ""),
    farmName: String(d.farmName || ""),
    farmType: String(d.farmType || "farm"),
    farmLocation: String(d.farmLocation || ""),
    sellerPhone: String(d.sellerPhone || ""),
    sellerEmail: String(d.sellerEmail || ""),
    buyerName: String(d.buyerName || ""),
    footerNote: String(d.footerNote || ""),
    selectedIds: Array.isArray(d.selectedIds) ? d.selectedIds.map(String) : [],
    customItems,
  };
}

function rowToSaved(row: Record<string, unknown>): SavedSalesMemo {
  return {
    id: String(row.id),
    memo_no: String(row.memo_no),
    memo_date: String(row.memo_date).slice(0, 10),
    buyer_name: row.buyer_name != null ? String(row.buyer_name) : null,
    grand_total: Number(row.grand_total) || 0,
    draft: parseDraft(row.draft),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function formSnapshotToDraft(snapshot: SalesMemoFormSnapshot, records: SaleRecordRow[]): SalesMemoDraft {
  const selectedSet = new Set(snapshot.selectedIds);
  const recordItems: SalesMemoLine[] = records
    .filter((r) => selectedSet.has(r.id))
    .map((r) => ({
      id: r.id,
      date: r.date,
      product: r.product,
      category: r.category,
      quantity: r.quantity,
      unit: r.unit,
      unitPrice: r.unit_price,
      lineTotal: r.total,
    }));
  const items = [...recordItems, ...snapshot.customItems];
  return {
    memoNo: snapshot.memoNo,
    memoDate: snapshot.memoDate,
    buyerName: snapshot.buyerName,
    farm: {
      name: snapshot.farmName.trim() || "My Farm",
      type: snapshot.farmType,
      location: snapshot.farmLocation.trim() || undefined,
      phone: snapshot.sellerPhone.trim() || undefined,
      email: snapshot.sellerEmail.trim() || undefined,
    },
    items,
    grandTotal: items.reduce((s, i) => s + i.lineTotal, 0),
    footerNote: snapshot.footerNote.trim() || undefined,
  };
}

export function draftToSavePayload(draft: SalesMemoDraft, snapshot: SalesMemoFormSnapshot) {
  return {
    memo_no: draft.memoNo,
    memo_date: draft.memoDate,
    buyer_name: draft.buyerName.trim() || null,
    grand_total: draft.grandTotal,
    draft: snapshot,
  };
}

export async function fetchSalesMemos(): Promise<SavedSalesMemo[]> {
  const { data, error } = await api.from("sales_memos").select("*");
  if (error) throw new Error(error.message);
  return ((data as Record<string, unknown>[]) || []).map(rowToSaved);
}

export async function saveSalesMemo(
  draft: SalesMemoDraft,
  snapshot: SalesMemoFormSnapshot,
): Promise<SavedSalesMemo> {
  const { data, error } = await api.from("sales_memos").insert(draftToSavePayload(draft, snapshot));
  if (error) throw new Error(error.message);
  return rowToSaved(data as Record<string, unknown>);
}

export async function updateSalesMemo(
  id: string,
  draft: SalesMemoDraft,
  snapshot: SalesMemoFormSnapshot,
): Promise<SavedSalesMemo> {
  const { data, error } = await api
    .from("sales_memos")
    .update(draftToSavePayload(draft, snapshot))
    .eq("id", id);
  if (error) throw new Error(error.message);
  return rowToSaved(data as Record<string, unknown>);
}

export async function deleteSalesMemo(id: string): Promise<void> {
  const { error } = await api.from("sales_memos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
