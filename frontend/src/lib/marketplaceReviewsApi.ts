import { API_BASE, readSession } from "@/api/client";

export interface ProductReviewRow {
  id: string;
  order_id: string;
  product_id: string;
  buyer_id: string;
  rating: number;
  comment: string | null;
  photo_urls: string[];
  created_at: string;
  buyer_name?: string | null;
  buyer_avatar?: string | null;
  seller_reply?: string | null;
  seller_reply_at?: string | null;
}

export interface ProductCommentReplyRow {
  id: string;
  body: string;
  created_at: string;
  updated_at?: string;
  user_name?: string | null;
  user_avatar?: string | null;
}

export interface ProductCommentRow {
  id: string;
  product_id: string;
  user_id: string;
  body: string;
  created_at: string;
  user_name?: string | null;
  user_avatar?: string | null;
  seller_reply?: ProductCommentReplyRow | null;
}

export interface SellerReviewRow extends ProductReviewRow {
  product_name?: string | null;
  product_image?: string | null;
  seller_reply_updated_at?: string | null;
}

export interface SellerCommentRow extends ProductCommentRow {
  product_name?: string | null;
  product_image?: string | null;
}

export interface SellerReviewStats {
  total: number;
  needsReplyCount: number;
  repliedCount: number;
  responseRate: number;
}

export interface OrderReviewStatusItem {
  productId: string;
  name: string;
  image: string | null;
  canReview: boolean;
  alreadyReviewed: boolean;
  reviewId: string | null;
}

export interface PendingReviewable {
  orderId: string;
  productId: string;
  productName: string;
  productImage: string | null;
  orderDate: string | null;
  sellerName: string | null;
}

async function authJson<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string }> {
  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) return { ok: false, error: body.error || res.statusText };
  return { ok: true, data: body.data };
}

function normalizePhotoUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapReview(row: Record<string, unknown>): ProductReviewRow {
  return {
    id: String(row.id),
    order_id: String(row.order_id),
    product_id: String(row.product_id),
    buyer_id: String(row.buyer_id),
    rating: Number(row.rating),
    comment: row.comment != null ? String(row.comment) : null,
    photo_urls: normalizePhotoUrls(row.photo_urls),
    created_at: String(row.created_at),
    buyer_name: row.buyer_name != null ? String(row.buyer_name) : null,
    buyer_avatar: row.buyer_avatar != null ? String(row.buyer_avatar) : null,
    seller_reply: row.seller_reply != null ? String(row.seller_reply) : null,
    seller_reply_at: row.seller_reply_at != null ? String(row.seller_reply_at) : null,
  };
}

function mapCommentReply(raw: Record<string, unknown> | null | undefined): ProductCommentReplyRow | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: String(raw.id),
    body: String(raw.body),
    created_at: String(raw.created_at),
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined,
    user_name: raw.user_name != null ? String(raw.user_name) : null,
    user_avatar: raw.user_avatar != null ? String(raw.user_avatar) : null,
  };
}

function mapComment(row: Record<string, unknown>): ProductCommentRow {
  return {
    id: String(row.id),
    product_id: String(row.product_id),
    user_id: String(row.user_id),
    body: String(row.body),
    created_at: String(row.created_at),
    user_name: row.user_name != null ? String(row.user_name) : null,
    user_avatar: row.user_avatar != null ? String(row.user_avatar) : null,
    seller_reply: mapCommentReply(row.seller_reply as Record<string, unknown> | null),
  };
}

export function mapSellerReview(row: Record<string, unknown>): SellerReviewRow {
  return {
    ...mapReview(row),
    product_name: row.product_name != null ? String(row.product_name) : null,
    product_image: row.product_image != null ? String(row.product_image) : null,
    seller_reply_updated_at: row.seller_reply_updated_at != null ? String(row.seller_reply_updated_at) : null,
  };
}

export function mapSellerComment(row: Record<string, unknown>): SellerCommentRow {
  return {
    ...mapComment(row),
    product_name: row.product_name != null ? String(row.product_name) : null,
    product_image: row.product_image != null ? String(row.product_image) : null,
  };
}

export interface SubmitProductReviewResult {
  review: Record<string, unknown>;
  rating: number;
  reviewCount: number;
}

export async function fetchProductReviews(productId: string, page = 1) {
  const { ok, data, error } = await authJson<{
    reviews: Record<string, unknown>[];
    page: number;
    limit: number;
    total: number;
    averageRating?: number;
  }>(`/v1/marketplace/products/${productId}/reviews?page=${page}`);
  if (!ok || !data) return { ok: false as const, error: error || "Failed to load reviews" };
  return {
    ok: true as const,
    reviews: (data.reviews || []).map(mapReview),
    page: data.page,
    total: data.total,
    averageRating: Number(data.averageRating ?? 0),
  };
}

export async function fetchProductComments(productId: string, page = 1) {
  const { ok, data, error } = await authJson<{
    comments: Record<string, unknown>[];
    page: number;
    limit: number;
    total: number;
  }>(`/v1/marketplace/products/${productId}/comments?page=${page}`);
  if (!ok || !data) return { ok: false as const, error: error || "Failed to load comments" };
  return {
    ok: true as const,
    comments: (data.comments || []).map(mapComment),
    page: data.page,
    total: data.total,
  };
}

export async function submitProductComment(productId: string, body: string) {
  return authJson(`/v1/marketplace/products/${productId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function fetchOrderReviewStatus(orderId: string) {
  const { ok, data, error } = await authJson<{
    orderId: string;
    status: string;
    items: OrderReviewStatusItem[];
  }>(`/v1/orders/${orderId}/review-status`);
  if (!ok || !data) return { ok: false as const, error: error || "Failed to load review status" };
  return { ok: true as const, data };
}

export async function fetchPendingReviewables(productId?: string) {
  const query = productId ? `?product_id=${encodeURIComponent(productId)}` : "";
  const { ok, data, error } = await authJson<PendingReviewable[]>(
    `/v1/marketplace/reviews/pending${query}`,
  );
  if (!ok || !data) return { ok: false as const, error: error || "Failed to load pending reviews" };
  return { ok: true as const, items: data };
}

export async function submitProductReview(payload: {
  order_id: string;
  product_id: string;
  rating: number;
  comment?: string;
  photo_urls?: string[];
}) {
  return authJson<SubmitProductReviewResult>(`/v1/marketplace/reviews`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadReviewPhoto(fileData: string) {
  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}/v1/marketplace/reviews/upload-photo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ image: fileData }),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: { url?: string }; error?: string };
  if (!res.ok) return { ok: false as const, error: body.error || res.statusText };
  return { ok: true as const, url: body.data?.url || "" };
}

export async function adminListReviews() {
  return authJson<Record<string, unknown>[]>("/v1/marketplace/admin/reviews");
}

export async function adminDeleteReview(reviewId: string) {
  return authJson(`/v1/marketplace/admin/reviews/${reviewId}`, { method: "DELETE" });
}

export async function adminListProductComments() {
  return authJson<Record<string, unknown>[]>("/v1/marketplace/admin/product-comments");
}

export async function adminDeleteProductComment(commentId: string) {
  return authJson(`/v1/marketplace/admin/product-comments/${commentId}`, { method: "DELETE" });
}

export async function fetchSellerReviews(opts?: {
  filter?: "all" | "needs_reply" | "replied";
  productId?: string;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.filter && opts.filter !== "all") params.set("filter", opts.filter);
  if (opts?.productId) params.set("product_id", opts.productId);
  if (opts?.page) params.set("page", String(opts.page));
  const qs = params.toString();
  const { ok, data, error } = await authJson<{
    reviews: Record<string, unknown>[];
    page: number;
    limit: number;
    total: number;
    stats: SellerReviewStats;
  }>(`/v1/marketplace/seller/reviews${qs ? `?${qs}` : ""}`);
  if (!ok || !data) return { ok: false as const, error: error || "Failed to load reviews" };
  return {
    ok: true as const,
    reviews: (data.reviews || []).map(mapSellerReview),
    page: data.page,
    total: data.total,
    stats: data.stats,
  };
}

export async function submitSellerReviewReply(reviewId: string, reply: string) {
  return authJson<Record<string, unknown>>(`/v1/marketplace/seller/reviews/${reviewId}/reply`, {
    method: "PUT",
    body: JSON.stringify({ reply }),
  });
}

export async function fetchSellerProductComments(opts?: {
  filter?: "all" | "needs_reply" | "replied";
  page?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.filter && opts.filter !== "all") params.set("filter", opts.filter);
  if (opts?.page) params.set("page", String(opts.page));
  const qs = params.toString();
  const { ok, data, error } = await authJson<{
    comments: Record<string, unknown>[];
    page: number;
    limit: number;
    total: number;
    stats: SellerReviewStats;
  }>(`/v1/marketplace/seller/product-comments${qs ? `?${qs}` : ""}`);
  if (!ok || !data) return { ok: false as const, error: error || "Failed to load comments" };
  return {
    ok: true as const,
    comments: (data.comments || []).map(mapSellerComment),
    page: data.page,
    total: data.total,
    stats: data.stats,
  };
}

export async function submitSellerCommentReply(commentId: string, body: string) {
  return authJson<Record<string, unknown>>(`/v1/marketplace/seller/product-comments/${commentId}/reply`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}
