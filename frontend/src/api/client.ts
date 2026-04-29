import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { withApiTiming } from "@/lib/perfMetrics";

/**
 * FarmBondhu browser client: all data and auth go through the Express API (`/api/v1/...`).
 * Set `VITE_API_URL` (e.g. http://127.0.0.1:3001) so requests go straight to your backend; backend CORS must allow this Vite origin.
 */
export const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

const AUTH_KEY = "farmbondhu.session";

export type AppSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
};

export function readSession(): AppSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AppSession) : null;
  } catch {
    return null;
  }
}

function writeSession(s: AppSession | null) {
  if (!s) localStorage.removeItem(AUTH_KEY);
  else localStorage.setItem(AUTH_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("farmbondhu:auth"));
}

/** Clears persisted tokens and notifies `api.auth.onAuthStateChange` listeners (e.g. stale JWT after server secret change). */
export function clearStoredSession() {
  writeSession(null);
}

function authHeaders(method: string, hasBody: boolean): HeadersInit {
  const s = readSession();
  const h: Record<string, string> = {};
  if (s?.access_token) h.Authorization = `Bearer ${s.access_token}`;
  const upper = String(method || "GET").toUpperCase();
  if (hasBody && upper !== "GET" && upper !== "HEAD") {
    h["Content-Type"] = "application/json";
  }
  return h;
}

async function apiJson(path: string, init: RequestInit = {}) {
  let res: Response;
  let text: string;
  const method = String(init.method || "GET").toUpperCase();
  const hasBody = init.body !== undefined && init.body !== null && init.body !== "";
  try {
    res = await withApiTiming(path, () =>
      fetch(`${API_BASE}${path}`, {
        ...init,
        headers: { ...authHeaders(method, hasBody), ...(init.headers || {}) },
      })
    );
    text = await res.text();
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Network error";
    return {
      // `Response` status must be 200-599 in browsers; use 503 for network-unreachable synthetic failures.
      res: new Response(null, { status: 503, statusText: "Network Error" }),
      body: {
        error: `Cannot reach the API (${reason}). Check that the backend is running and VITE_API_URL matches it (e.g. http://127.0.0.1:3001).`,
      },
    };
  }
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = { error: text || `Invalid response (${res.status})` };
  }
  return { res, body };
}

/** Prefer JSON `error`, then HTTP status, then fallback — never an empty string. */
function messageFromApiJson(body: Record<string, unknown>, res: Response, fallback: string): string {
  const err = body.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (typeof err === "number" || typeof err === "boolean") return String(err);
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    const m = (err as { message: string }).message.trim();
    if (m) return m;
  }
  if (!res.ok) {
    const bits = [String(res.status), res.statusText].filter(Boolean);
    if (bits.length) return `Request failed (${bits.join(" ")}). ${fallback}`;
  }
  return fallback;
}

type Filter =
  | { type: "eq"; column: string; value: unknown }
  | { type: "in"; column: string; value: unknown[] }
  | { type: "gte"; column: string; value: unknown }
  | { type: "or"; expr: string }
  | { type: "order"; column: string; ascending: boolean }
  | { type: "limit"; n: number }
  | { type: "head"; count: "exact" };

class QueryBuilder implements PromiseLike<{ data: unknown; error: Error | null; count?: number | null }> {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private columns = "*";
  private filters: Filter[] = [];
  private expectOne = false;
  private expectMaybeOne = false;
  private insertRow: unknown | null = null;
  private updatePatch: Record<string, unknown> | null = null;
  private upsertRows: unknown[] | null = null;
  private headCount: boolean | null = null;
  /** After insert().select(), return created row from API response. */
  private wantReturning = false;

  constructor(private readonly table: string) {}

  select(columns = "*", opts?: { count?: "exact"; head?: boolean }) {
    if (this.insertRow && this.op === "insert") {
      this.wantReturning = true;
      this.columns = columns;
      if (opts?.count && opts?.head) {
        this.headCount = true;
        this.filters.push({ type: "head", count: "exact" });
      }
      return this;
    }
    this.op = "select";
    this.columns = columns;
    if (opts?.count && opts?.head) {
      this.headCount = true;
      this.filters.push({ type: "head", count: "exact" });
    }
    return this;
  }

  insert(row: unknown) {
    this.op = "insert";
    this.insertRow = row;
    this.wantReturning = false;
    return this;
  }

  update(patch: Record<string, unknown>) {
    this.op = "update";
    this.updatePatch = patch;
    return this;
  }

  delete() {
    this.op = "delete";
    return this;
  }

  upsert(rows: unknown | unknown[], _opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.upsertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ type: "in", column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ type: "gte", column, value });
    return this;
  }

  /** PostgREST-style OR filter (e.g. `buyer_id.eq.uuid,seller_id.eq.uuid`); only used for allowlisted compat queries. */
  or(expr: string) {
    this.filters.push({ type: "or", expr: String(expr || "").trim() });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.filters.push({ type: "order", column, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(n: number) {
    this.filters.push({ type: "limit", n });
    return this;
  }

  single() {
    this.expectOne = true;
    return this;
  }

  maybeSingle() {
    this.expectMaybeOne = true;
    return this;
  }

  then<TResult1 = { data: unknown; error: Error | null; count?: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: Error | null; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as never, onrejected as never);
  }

  catch(onrejected?: ((reason: unknown) => unknown) | null) {
    return this.execute().catch(onrejected ?? undefined);
  }

  private getEq(column: string) {
    const f = this.filters.find((x) => x.type === "eq" && x.column === column);
    return f && f.type === "eq" ? f.value : undefined;
  }

  private getIn(column: string) {
    const f = this.filters.find((x) => x.type === "in" && x.column === column);
    return f && f.type === "in" ? f.value : undefined;
  }

  private getGte(column: string) {
    const f = this.filters.find((x) => x.type === "gte" && x.column === column);
    return f && f.type === "gte" ? f.value : undefined;
  }

  private async execute() {
    const uid = readSession()?.user?.id;
    const inAdminArea = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
    try {
      if (this.op === "insert" && this.table === "orders" && this.insertRow && this.wantReturning) {
        const { res, body } = await apiJson("/v1/orders", {
          method: "POST",
          body: JSON.stringify(this.insertRow),
        });
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        let data = (body as { data: unknown }).data;
        if (this.expectOne && data && typeof data === "object") {
          data = data;
        }
        return { data, error: null };
      }

      if (this.op === "select" && this.table === "community_posts" && this.getEq("status") === "active" && !uid) {
        const { res, body } = await apiJson("/v1/public/community-posts");
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }

      if (this.op === "select" && this.table === "community_posts" && this.expectOne) {
        const id = this.getEq("id");
        if (id) {
          const { res, body } = await apiJson(`/v1/public/community-posts/${id}`);
          if (res.status === 404) return { data: null, error: { message: "PGRST116" } as unknown as Error };
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          return { data: (body as { data: unknown }).data, error: null };
        }
      }

      if (this.op === "insert" && (this.table === "farms" || this.table === "animals" || this.table === "sheds") && this.insertRow) {
        const { res, body } = await apiJson(`/v1/${this.table}`, {
          method: "POST",
          body: JSON.stringify(this.insertRow),
        });
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }
      if (this.op === "update" && (this.table === "farms" || this.table === "animals" || this.table === "sheds") && this.updatePatch) {
        const id = this.getEq("id");
        const { res, body } = await apiJson(`/v1/${this.table}/${id}`, {
          method: "PATCH",
          body: JSON.stringify(this.updatePatch),
        });
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }
      if (this.op === "delete" && (this.table === "farms" || this.table === "animals" || this.table === "sheds")) {
        const id = this.getEq("id");
        const { res, body } = await apiJson(`/v1/${this.table}/${id}`, { method: "DELETE" });
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: null, error: null };
      }

      if (this.op === "select" && this.headCount && this.table === "notifications") {
        const { res, body } = await apiJson("/v1/notifications/unread-count");
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)), count: null };
        return { data: null, error: null, count: (body as { count?: number }).count ?? 0 };
      }

      if (this.op === "select" && this.table === "farms" && !this.expectOne) {
        const { res, body } = await apiJson("/v1/farms");
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }
      if (this.op === "select" && this.table === "farms" && this.expectOne) {
        const id = this.getEq("id");
        const { res, body } = await apiJson(`/v1/farms/${id}`);
        if (res.status === 404) return { data: null, error: { message: "PGRST116" } as unknown as Error };
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }

      if (this.op === "select" && this.table === "animals" && !this.expectOne) {
        const { res, body } = await apiJson("/v1/animals");
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        let rows = (body as { data: unknown[] }).data || [];
        const headF = this.filters.find((f): f is Extract<Filter, { type: "head" }> => f.type === "head");
        if (headF) {
          return { data: null, error: null, count: rows.length };
        }
        return { data: rows, error: null };
      }
      if (this.op === "select" && this.table === "animals" && this.expectOne) {
        const id = this.getEq("id");
        const { res, body } = await apiJson(`/v1/animals/${id}`);
        if (res.status === 404) return { data: null, error: { message: "PGRST116" } as unknown as Error };
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }

      if (this.op === "select" && this.table === "sheds" && !this.expectOne) {
        const { res, body } = await apiJson("/v1/sheds");
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }
      if (this.op === "select" && this.table === "sheds" && this.expectOne) {
        const id = this.getEq("id");
        const { res, body } = await apiJson(`/v1/sheds/${id}`);
        if (res.status === 404) return { data: null, error: { message: "PGRST116" } as unknown as Error };
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }

      const dashMap: Record<string, string> = {
        feed_records: "/v1/dashboard/feed-records",
        feed_inventory: "/v1/dashboard/feed-inventory",
        production_records: "/v1/dashboard/production-records",
        financial_records: "/v1/dashboard/financial-records",
        mortality_records: "/v1/dashboard/mortality-records",
        health_records: "/v1/dashboard/health-records",
        sale_records: "/v1/dashboard/sale-records",
      };
      if (this.op === "select" && this.table === "dashboard_overview") {
        const { res, body } = await apiJson("/v1/dashboard/overview-bundle");
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }
      if (this.op === "select" && dashMap[this.table]) {
        const { res, body } = await apiJson(dashMap[this.table]);
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        let rows = ((body as { data: unknown[] }).data || []) as Record<string, unknown>[];
        const lim = this.filters.find((f): f is Extract<Filter, { type: "limit" }> => f.type === "limit");
        if (lim) rows = rows.slice(0, lim.n);
        const headF = this.filters.find((f): f is Extract<Filter, { type: "head" }> => f.type === "head");
        if (headF) return { data: null, error: null, count: rows.length };
        return { data: rows, error: null };
      }

      if (this.op !== "select" && dashMap[this.table]) {
        const base = dashMap[this.table];
        if (this.op === "insert" && this.insertRow) {
          const { res, body } = await apiJson(base, { method: "POST", body: JSON.stringify(this.insertRow) });
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          return { data: (body as { data: unknown }).data, error: null };
        }
        if (this.op === "update" && this.updatePatch) {
          const id = this.getEq("id");
          const { res, body } = await apiJson(`${base}/${id}`, {
            method: "PATCH",
            body: JSON.stringify(this.updatePatch),
          });
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          return { data: (body as { data: unknown }).data, error: null };
        }
        if (this.op === "delete") {
          const id = this.getEq("id");
          const { res, body } = await apiJson(`${base}/${id}`, { method: "DELETE" });
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          return { data: null, error: null };
        }
      }

      if (this.op === "select" && this.table === "notifications" && !this.headCount) {
        const { res, body } = await apiJson("/v1/notifications");
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }
      if (this.op === "update" && this.table === "notifications") {
        const inF = this.filters.find((f): f is Extract<Filter, { type: "in" }> => f.type === "in" && f.column === "id");
        if (inF && inF.type === "in" && Array.isArray(inF.value)) {
          const { res, body } = await apiJson("/v1/notifications/mark-read", {
            method: "POST",
            body: JSON.stringify({ ids: inF.value }),
          });
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          return { data: null, error: null };
        }
        const id = this.getEq("id");
        const { res, body } = await apiJson(`/v1/notifications/${id}`, {
          method: "PATCH",
          body: JSON.stringify(this.updatePatch || {}),
        });
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }

      if (this.op === "select" && this.table === "orders") {
        const { res, body } = await apiJson("/v1/orders");
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }
      if (this.op === "insert" && this.table === "orders" && this.insertRow) {
        const { res, body } = await apiJson("/v1/orders", { method: "POST", body: JSON.stringify(this.insertRow) });
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }
      if (this.op === "update" && this.table === "orders") {
        const id = this.getEq("id");
        const { res, body } = await apiJson(`/v1/orders/${id}`, {
          method: "PATCH",
          body: JSON.stringify(this.updatePatch || {}),
        });
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }

      if (this.op === "upsert" && this.upsertRows && uid) {
        const payload =
          this.table === "user_capabilities" && this.upsertRows.length === 1
            ? { action: "upsert", table: this.table, row: this.upsertRows[0] }
            : { action: "upsert", table: this.table, rows: this.upsertRows };
        const { res, body } = await apiJson("/v1/compat/from/admin", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: null, error: null };
      }

      if (this.op === "select" && this.table === "conversations" && !this.expectOne && !this.expectMaybeOne) {
        const sellerEq = this.filters.find((f): f is Extract<Filter, { type: "eq" }> => f.type === "eq" && f.column === "seller_id");
        const orF = this.filters.find((f): f is Extract<Filter, { type: "or" }> => f.type === "or");
        const path = sellerEq || orF ? "/v1/compat/from" : "/v1/compat/from/admin";
        const payload: Record<string, unknown> = {
          action: "select",
          table: "conversations",
          mode: orF ? "participant_inbox" : sellerEq ? "seller_inbox" : "admin_all",
        };
        let { res, body } = await apiJson(path, { method: "POST", body: JSON.stringify(payload) });
        if (res.status === 403 && path === "/v1/compat/from/admin") {
          const fallbackPayload = { action: "select", table: "conversations", mode: "participant_inbox" };
          const fallback = await apiJson("/v1/compat/from", { method: "POST", body: JSON.stringify(fallbackPayload) });
          res = fallback.res;
          body = fallback.body;
        }
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        const rows = (body as { data?: unknown[] }).data;
        return { data: Array.isArray(rows) ? rows : [], error: null };
      }

      if (this.op === "select" && this.table === "products") {
        const sellerId = this.getEq("seller_id");
        const sellerName = this.getEq("seller_name");
        const id = this.getEq("id");
        const lim = this.filters.find((f): f is Extract<Filter, { type: "limit" }> => f.type === "limit");
        if (this.expectOne && id) {
          const { res, body } = await apiJson(`/v1/marketplace/products/${id}`);
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          return { data: (body as { data: unknown }).data, error: null };
        }
        const q = new URLSearchParams();
        if (sellerId) q.set("seller_id", String(sellerId));
        if (sellerName) q.set("seller_name", String(sellerName));
        if (lim) q.set("limit", String(lim.n));
        const { res, body } = await apiJson(`/v1/marketplace/products?${q.toString()}`);
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }
      if (this.op === "insert" && this.table === "products" && this.insertRow) {
        const { res, body } = await apiJson("/v1/marketplace/products", {
          method: "POST",
          body: JSON.stringify(this.insertRow),
        });
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }
      if (this.op === "update" && this.table === "products") {
        const id = this.getEq("id");
        const { res, body } = await apiJson(`/v1/marketplace/products/${id}`, {
          method: "PATCH",
          body: JSON.stringify(this.updatePatch || {}),
        });
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }
      if (this.op === "delete" && this.table === "products") {
        const id = this.getEq("id");
        const { res, body } = await apiJson(`/v1/marketplace/products/${id}`, { method: "DELETE" });
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: null, error: null };
      }

      if (this.op === "select" && this.table === "learning_guides") {
        const { res, body } = await apiJson("/v1/learning/guides");
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data: unknown }).data, error: null };
      }

      if (
        this.table === "vets" ||
        this.table === "consultation_bookings" ||
        this.table === "consultation_messages" ||
        this.table === "vet_availability" ||
        this.table === "prescriptions" ||
        this.table === "prescription_items" ||
        this.table === "e_prescriptions"
      ) {
        if (this.table === "vets") {
          if (this.op === "select") {
            const id = this.getEq("id");
            if (id && this.expectOne) {
              const { res, body } = await apiJson(`/v1/medibondhu/vets/${id}`);
              if (res.status === 404) return { data: null, error: { message: "PGRST116" } as unknown as Error };
              if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
              return { data: (body as { data: unknown }).data, error: null };
            }
            const lim = this.filters.find((f): f is Extract<Filter, { type: "limit" }> => f.type === "limit");
            const q = new URLSearchParams();
            if (lim) q.set("limit", String(lim.n));
            if (this.getEq("available") === true) q.set("available", "true");
            const { res, body } = await apiJson(`/v1/medibondhu/vets?${q.toString()}`);
            if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
            return { data: (body as { data: unknown }).data ?? [], error: null };
          }
        }

        if (this.table === "consultation_bookings") {
          if (this.op === "select") {
            const id = this.getEq("id");
            const lim = this.filters.find((f): f is Extract<Filter, { type: "limit" }> => f.type === "limit");
            const ord = this.filters.find((f): f is Extract<Filter, { type: "order" }> => f.type === "order");
            const statusIn = this.getIn("status");
            const q = new URLSearchParams();
            if (id) q.set("id", String(id));
            const patientId = this.getEq("patient_mock_id");
            const vetId = this.getEq("vet_mock_id");
            const vetUserId = this.getEq("vet_user_id");
            const status = this.getEq("status");
            const createdGte = this.getGte("created_at");
            if (patientId) q.set("patient_mock_id", String(patientId));
            if (vetId) q.set("vet_mock_id", String(vetId));
            if (vetUserId) q.set("vet_user_id", String(vetUserId));
            if (status) q.set("status", String(status));
            if (statusIn && Array.isArray(statusIn) && statusIn.length) q.set("status_in", statusIn.map(String).join(","));
            if (createdGte) q.set("created_gte", String(createdGte));
            if (lim) q.set("limit", String(lim.n));
            if (ord?.column === "created_at") q.set("ascending", String(ord.ascending));
            const { res, body } = await apiJson(`/v1/medibondhu/bookings?${q.toString()}`);
            if (res.status === 404 && this.expectOne) return { data: null, error: { message: "PGRST116" } as unknown as Error };
            if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
            const data = (body as { data: unknown }).data;
            if (this.expectOne || this.expectMaybeOne) return { data: data || null, error: null };
            return { data: (Array.isArray(data) ? data : data ? [data] : []) as unknown, error: null };
          }
          if (this.op === "insert" && this.insertRow) {
            const { res, body } = await apiJson("/v1/medibondhu/bookings", {
              method: "POST",
              body: JSON.stringify(this.insertRow),
            });
            if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
            const data = (body as { data?: unknown }).data ?? null;
            return { data: this.expectOne || this.wantReturning ? data : null, error: null };
          }
          if (this.op === "update" && this.updatePatch) {
            const id = this.getEq("id");
            if (!id) return { data: null, error: new Error("consultation_bookings update requires .eq('id', ...)") };
            const { res, body } = await apiJson(`/v1/medibondhu/bookings/${id}`, {
              method: "PATCH",
              body: JSON.stringify(this.updatePatch),
            });
            if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
            return { data: (body as { data?: unknown }).data ?? null, error: null };
          }
        }

        if (this.table === "consultation_messages") {
          const bookingId = this.getEq("booking_id");
          if (!bookingId) return { data: null, error: new Error("consultation_messages requires .eq('booking_id', ...)") };
          if (this.op === "select") {
            const { res, body } = await apiJson(`/v1/medibondhu/bookings/${bookingId}/messages`);
            if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
            return { data: (body as { data: unknown }).data ?? [], error: null };
          }
          if (this.op === "insert" && this.insertRow) {
            const { res, body } = await apiJson(`/v1/medibondhu/bookings/${bookingId}/messages`, {
              method: "POST",
              body: JSON.stringify(this.insertRow),
            });
            if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
            return { data: (body as { data?: unknown }).data ?? null, error: null };
          }
        }

        if (this.table === "vet_availability") {
          if (this.op === "select") {
            const userId = this.getEq("user_id");
            const q = new URLSearchParams();
            if (userId) q.set("user_id", String(userId));
            const { res, body } = await apiJson(`/v1/medibondhu/availability?${q.toString()}`);
            if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
            return { data: (body as { data: unknown }).data ?? [], error: null };
          }
          if (this.op === "delete") {
            const id = this.getEq("id");
            const userId = this.getEq("user_id");
            const path = id ? `/v1/medibondhu/availability/${id}` : `/v1/medibondhu/availability${userId ? `?user_id=${encodeURIComponent(String(userId))}` : ""}`;
            const { res, body } = await apiJson(path, { method: "DELETE" });
            if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
            return { data: null, error: null };
          }
          if (this.op === "insert" && this.insertRow) {
            const rows = Array.isArray(this.insertRow) ? this.insertRow : [this.insertRow];
            const { res, body } = await apiJson("/v1/medibondhu/availability/bulk", {
              method: "POST",
              body: JSON.stringify({ rows }),
            });
            if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
            return { data: null, error: null };
          }
        }

        if (this.table === "prescriptions") {
          if (this.op === "select") {
            const id = this.getEq("id");
            if (id && this.expectOne) {
              const { res, body } = await apiJson(`/v1/medibondhu/prescriptions/${id}`);
              if (res.status === 404) return { data: null, error: { message: "PGRST116" } as unknown as Error };
              if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
              return { data: (body as { data: unknown }).data ?? null, error: null };
            }
            const q = new URLSearchParams();
            const vetUserId = this.getEq("vet_user_id");
            const farmerUserId = this.getEq("farmer_user_id");
            const lim = this.filters.find((f): f is Extract<Filter, { type: "limit" }> => f.type === "limit");
            if (vetUserId) q.set("vet_user_id", String(vetUserId));
            if (farmerUserId) q.set("farmer_user_id", String(farmerUserId));
            if (lim) q.set("limit", String(lim.n));
            const { res, body } = await apiJson(`/v1/medibondhu/prescriptions?${q.toString()}`);
            if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
            return { data: (body as { data: unknown }).data ?? [], error: null };
          }
          if (this.op === "insert" && this.insertRow) {
            const { res, body } = await apiJson("/v1/medibondhu/prescriptions", {
              method: "POST",
              body: JSON.stringify(this.insertRow),
            });
            if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
            return { data: (body as { data?: unknown }).data ?? null, error: null };
          }
        }

        if (this.table === "prescription_items") {
          let prescriptionId = this.getEq("prescription_id");
          if (!prescriptionId && this.op === "insert" && this.insertRow) {
            const rows = Array.isArray(this.insertRow) ? this.insertRow : [this.insertRow];
            const ids = Array.from(
              new Set(rows.map((r) => (r && typeof r === "object" ? (r as { prescription_id?: unknown }).prescription_id : undefined)))
            ).filter(Boolean);
            if (ids.length === 1) prescriptionId = ids[0];
          }
          if (!prescriptionId) return { data: null, error: new Error("prescription_items requires prescription_id") };
          if (this.op === "select") {
            const { res, body } = await apiJson(`/v1/medibondhu/prescriptions/${prescriptionId}/items`);
            if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
            return { data: (body as { data: unknown }).data ?? [], error: null };
          }
          if (this.op === "insert" && this.insertRow) {
            const rows = Array.isArray(this.insertRow) ? this.insertRow : [this.insertRow];
            const { res, body } = await apiJson(`/v1/medibondhu/prescriptions/${prescriptionId}/items/bulk`, {
              method: "POST",
              body: JSON.stringify({ rows }),
            });
            if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
            return { data: null, error: null };
          }
        }

        if (this.table === "e_prescriptions" && this.op === "select") {
          const patientId = this.getEq("patient_mock_id");
          const q = new URLSearchParams();
          if (patientId) q.set("patient_mock_id", String(patientId));
          const { res, body } = await apiJson(`/v1/medibondhu/e-prescriptions?${q.toString()}`);
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          return { data: (body as { data: unknown }).data ?? [], error: null };
        }
      }

      if (this.table === "profiles") {
        if (this.op === "select") {
          const id = this.getEq("id");
          if (id && this.expectOne) {
            const { res, body } = await apiJson(`/v1/profiles/${id}`);
            if (res.status === 404) return { data: null, error: { message: "PGRST116" } as unknown as Error };
            if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
            return { data: (body as { data: unknown }).data ?? null, error: null };
          }

          if (!inAdminArea) {
            return { data: [], error: null };
          }
          let { res, body } = await apiJson("/v1/compat/from/admin", {
            method: "POST",
            body: JSON.stringify({ action: "select", table: "profiles", mode: "all_admin" }),
          });
          if (res.status === 403) {
            return { data: [], error: null };
          }
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          let rows = ((body as { data?: unknown[] }).data || []) as Record<string, unknown>[];

          const status = this.getEq("status");
          if (status) rows = rows.filter((r) => String(r.status || "") === String(status));
          const ord = this.filters.find((f): f is Extract<Filter, { type: "order" }> => f.type === "order");
          if (ord?.column === "created_at") {
            rows = [...rows].sort((a, b) => {
              const ta = new Date(String(a.created_at || 0)).getTime();
              const tb = new Date(String(b.created_at || 0)).getTime();
              return ord.ascending ? ta - tb : tb - ta;
            });
          }
          const lim = this.filters.find((f): f is Extract<Filter, { type: "limit" }> => f.type === "limit");
          if (lim) rows = rows.slice(0, lim.n);

          if (this.headCount) return { data: null, error: null, count: rows.length };
          if (this.expectOne || this.expectMaybeOne) return { data: rows[0] || null, error: null };
          return { data: rows, error: null };
        }

        if (this.op === "update" && this.updatePatch) {
          const id = this.getEq("id");
          if (!id) return { data: null, error: new Error("profiles update requires .eq('id', ...)") };
          const { res, body } = await apiJson("/v1/compat/from/admin", {
            method: "POST",
            body: JSON.stringify({ action: "update", table: "profiles", id, patch: this.updatePatch }),
          });
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          return { data: (body as { data?: unknown }).data ?? null, error: null };
        }
      }

      if (this.table === "user_roles") {
        if (this.op === "select") {
          if (!inAdminArea) return { data: [], error: null };
          const { res, body } = await apiJson("/v1/compat/from/admin", {
            method: "POST",
            body: JSON.stringify({ action: "select", table: "user_roles", mode: "list" }),
          });
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          let rows = ((body as { data?: unknown[] }).data || []) as Record<string, unknown>[];
          const userId = this.getEq("user_id");
          const role = this.getEq("role");
          if (userId) rows = rows.filter((r) => String(r.user_id || "") === String(userId));
          if (role) rows = rows.filter((r) => String(r.role || "") === String(role));
          if (this.expectOne || this.expectMaybeOne) return { data: rows[0] || null, error: null };
          return { data: rows, error: null };
        }

        if (this.op === "insert" && this.insertRow) {
          const row = Array.isArray(this.insertRow) ? this.insertRow[0] : this.insertRow;
          const payload = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
          const { res, body } = await apiJson("/v1/compat/from/admin", {
            method: "POST",
            body: JSON.stringify({
              action: "insert",
              table: "user_roles",
              user_id: payload.user_id,
              role: payload.role,
            }),
          });
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          return { data: (body as { data?: unknown }).data ?? null, error: null };
        }

        if (this.op === "delete") {
          const userId = this.getEq("user_id");
          const role = this.getEq("role");
          if (!userId || !role) return { data: null, error: new Error("user_roles delete requires user_id and role filters") };
          const { res, body } = await apiJson("/v1/compat/from/admin", {
            method: "POST",
            body: JSON.stringify({ action: "delete", table: "user_roles", user_id: userId, role }),
          });
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          return { data: null, error: null };
        }
      }

      if (this.table === "user_capabilities") {
        if (this.op === "select") {
          if (!inAdminArea) return { data: [], error: null };
          const { res, body } = await apiJson("/v1/compat/from/admin", {
            method: "POST",
            body: JSON.stringify({ action: "select", table: "user_capabilities", mode: "list" }),
          });
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          let rows = ((body as { data?: unknown[] }).data || []) as Record<string, unknown>[];
          const userId = this.getEq("user_id");
          const capCode = this.getEq("capability_code");
          if (userId) rows = rows.filter((r) => String(r.user_id || "") === String(userId));
          if (capCode) rows = rows.filter((r) => String(r.capability_code || "") === String(capCode));
          if (this.expectOne || this.expectMaybeOne) return { data: rows[0] || null, error: null };
          return { data: rows, error: null };
        }

        if ((this.op === "insert" && this.insertRow) || (this.op === "update" && this.updatePatch)) {
          const userId = this.getEq("user_id");
          const capCode = this.getEq("capability_code");
          let row: Record<string, unknown> = {};
          if (this.op === "insert") {
            row = Array.isArray(this.insertRow) ? ((this.insertRow[0] as Record<string, unknown>) || {}) : ((this.insertRow as Record<string, unknown>) || {});
          } else {
            row = { user_id: userId, capability_code: capCode, ...(this.updatePatch || {}) };
          }
          if (!row.user_id || !row.capability_code) {
            return { data: null, error: new Error("user_capabilities write requires user_id and capability_code") };
          }
          const { res, body } = await apiJson("/v1/compat/from/admin", {
            method: "POST",
            body: JSON.stringify({ action: "upsert", table: "user_capabilities", row }),
          });
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          return { data: null, error: null };
        }
      }

      if (this.table === "permissions" && this.op === "select") {
        if (!inAdminArea) return { data: [], error: null };
        const { res, body } = await apiJson("/v1/compat/from/admin", {
          method: "POST",
          body: JSON.stringify({ action: "select", table: "role_permissions", mode: "permissions_list" }),
        });
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        return { data: (body as { data?: unknown[] }).data ?? [], error: null };
      }

      if (this.table === "admin_team") {
        if (this.op === "select") {
          const { res, body } = await apiJson("/v1/compat/from/admin", {
            method: "POST",
            body: JSON.stringify({ action: "select", table: "admin_team", mode: "list" }),
          });
          if (!res.ok) {
            return {
              data: null,
              error: new Error(String((body as { error?: string }).error || res.status)),
            };
          }
          let rows = ((body as { data?: unknown[] }).data || []) as Record<string, unknown>[];
          const ord = this.filters.find((f): f is Extract<Filter, { type: "order" }> => f.type === "order");
          if (ord?.column === "created_at") {
            rows = [...rows].sort((a, b) => {
              const ta = new Date(String(a.created_at ?? 0)).getTime();
              const tb = new Date(String(b.created_at ?? 0)).getTime();
              return ord.ascending ? ta - tb : tb - ta;
            });
          }
          return { data: rows, error: null };
        }
        if (this.op === "insert" && this.insertRow) {
          const { res, body } = await apiJson("/v1/compat/from/admin", {
            method: "POST",
            body: JSON.stringify({ action: "insert", table: "admin_team", row: this.insertRow }),
          });
          if (!res.ok) {
            return {
              data: null,
              error: new Error(String((body as { error?: string }).error || res.status)),
            };
          }
          return { data: null, error: null };
        }
        if (this.op === "update" && this.updatePatch) {
          const id = this.getEq("id");
          if (!id) return { data: null, error: new Error("admin_team update requires .eq('id', ...)") };
          const { res, body } = await apiJson("/v1/compat/from/admin", {
            method: "POST",
            body: JSON.stringify({
              action: "update",
              table: "admin_team",
              id,
              patch: this.updatePatch,
            }),
          });
          if (!res.ok) {
            return {
              data: null,
              error: new Error(String((body as { error?: string }).error || res.status)),
            };
          }
          return { data: (body as { data?: unknown }).data ?? null, error: null };
        }
        if (this.op === "delete") {
          const id = this.getEq("id");
          if (!id) return { data: null, error: new Error("admin_team delete requires .eq('id', ...)") };
          const { res, body } = await apiJson("/v1/compat/from/admin", {
            method: "POST",
            body: JSON.stringify({ action: "delete", table: "admin_team", id }),
          });
          if (!res.ok) {
            return {
              data: null,
              error: new Error(String((body as { error?: string }).error || res.status)),
            };
          }
          return { data: null, error: null };
        }
      }

      if (this.table === "approval_requests") {
        if (this.op === "insert" && this.insertRow) {
          const { res, body } = await apiJson("/v1/compat/from", {
            method: "POST",
            body: JSON.stringify({ action: "insert", table: "approval_requests", row: this.insertRow }),
          });
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          return { data: (body as { data?: unknown }).data ?? null, error: null };
        }

        if (this.op === "update" && this.updatePatch) {
          const id = this.getEq("id");
          if (!id) return { data: null, error: new Error("approval_requests update requires .eq('id', ...)") };
          const { res, body } = await apiJson("/v1/compat/from/admin", {
            method: "POST",
            body: JSON.stringify({
              action: "update",
              table: "approval_requests",
              id,
              patch: this.updatePatch,
            }),
          });
          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          return { data: (body as { data?: unknown }).data ?? null, error: null };
        }

        if (this.op === "select") {
          const id = this.getEq("id");
          const status = this.getEq("status");
          const requestType = this.getEq("request_type");
          const userId = this.getEq("user_id");
          const lim = this.filters.find((f): f is Extract<Filter, { type: "limit" }> => f.type === "limit");
          const ord = this.filters.find((f): f is Extract<Filter, { type: "order" }> => f.type === "order");

          if (this.headCount) {
            if (String(status || "") === "pending") {
              const { res, body } = await apiJson("/v1/compat/from/admin", {
                method: "POST",
                body: JSON.stringify({ action: "count", table: "approval_requests", mode: "pending_head" }),
              });
              if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
              return { data: null, error: null, count: Number((body as { count?: unknown }).count || 0) };
            }
          }

          if (uid && userId && String(userId) === String(uid)) {
            const fallback = await apiJson("/v1/compat/from", {
              method: "POST",
              body: JSON.stringify({ action: "simple_user_select", table: "approval_requests", user_id: uid }),
            });
            if (!fallback.res.ok) return { data: null, error: new Error(String(fallback.body.error || fallback.res.status)) };
            let rows = ((fallback.body as { data?: unknown[] }).data || []) as Record<string, unknown>[];
            if (id) rows = rows.filter((r) => String(r.id || "") === String(id));
            if (status) rows = rows.filter((r) => String(r.status || "") === String(status));
            if (requestType) rows = rows.filter((r) => String(r.request_type || "") === String(requestType));
            if (ord?.column === "created_at") {
              rows = [...rows].sort((a, b) => {
                const ta = new Date(String(a.created_at || 0)).getTime();
                const tb = new Date(String(b.created_at || 0)).getTime();
                return ord.ascending ? ta - tb : tb - ta;
              });
            }
            if (lim) rows = rows.slice(0, lim.n);
            if (this.expectOne || this.expectMaybeOne) return { data: rows[0] || null, error: null };
            if (this.headCount) return { data: null, error: null, count: rows.length };
            return { data: rows, error: null };
          }

          const { res, body } = await apiJson("/v1/compat/from/admin", {
            method: "POST",
            body: JSON.stringify({
              action: "select",
              table: "approval_requests",
              mode: "list",
              id: id || null,
              status: status || null,
              request_type: requestType || null,
              user_id: userId || null,
              limit: lim?.n || null,
              ascending: ord?.column === "created_at" ? ord.ascending : undefined,
            }),
          });

          if (res.status === 403) {
            const fallback = await apiJson("/v1/compat/from", {
              method: "POST",
              body: JSON.stringify({ action: "simple_user_select", table: "approval_requests", user_id: uid }),
            });
            if (!fallback.res.ok) return { data: null, error: new Error(String(fallback.body.error || fallback.res.status)) };
            let rows = ((fallback.body as { data?: unknown[] }).data || []) as Record<string, unknown>[];
            if (id) rows = rows.filter((r) => String(r.id || "") === String(id));
            if (status) rows = rows.filter((r) => String(r.status || "") === String(status));
            if (requestType) rows = rows.filter((r) => String(r.request_type || "") === String(requestType));
            if (userId) rows = rows.filter((r) => String(r.user_id || "") === String(userId));
            if (ord?.column === "created_at") {
              rows = [...rows].sort((a, b) => {
                const ta = new Date(String(a.created_at || 0)).getTime();
                const tb = new Date(String(b.created_at || 0)).getTime();
                return ord.ascending ? ta - tb : tb - ta;
              });
            }
            if (lim) rows = rows.slice(0, lim.n);
            if (this.expectOne || this.expectMaybeOne) return { data: rows[0] || null, error: null };
            if (this.headCount) return { data: null, error: null, count: rows.length };
            return { data: rows, error: null };
          }

          if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
          const data = (body as { data?: unknown[] }).data || [];
          if (this.expectOne || this.expectMaybeOne) return { data: data[0] || null, error: null };
          if (this.headCount) return { data: null, error: null, count: data.length };
          return { data, error: null };
        }
      }

      const compatBody = await this.buildCompatBody(uid);
      if (compatBody && (compatBody as { __inline?: boolean }).__inline) {
        const inline = compatBody as { __inline?: boolean; data?: unknown; error?: Error | null };
        return { data: inline.data ?? null, error: inline.error || null };
      }
      if (compatBody) {
        const isAdmin = compatBody.__admin;
        delete compatBody.__admin;
        delete (compatBody as { __inline?: boolean }).__inline;
        const path = isAdmin ? "/v1/compat/from/admin" : "/v1/compat/from";
        let { res, body } = await apiJson(path, { method: "POST", body: JSON.stringify(compatBody) });
        if (isAdmin && res.status === 403) {
          const fallback = await apiJson("/v1/compat/from", { method: "POST", body: JSON.stringify(compatBody) });
          res = fallback.res;
          body = fallback.body;
        }
        if (res.status === 501) {
          return { data: null, error: new Error(`Not migrated to API yet: ${this.table} ${this.op}`) };
        }
        if (!res.ok) return { data: null, error: new Error(String(body.error || res.status)) };
        if ("count" in body && body.count !== undefined) return { data: null, error: null, count: body.count as number };
        return { data: (body as { data: unknown }).data ?? null, error: (body as { error?: { message?: string } }).error as Error | null };
      }

      return { data: null, error: new Error(`Unsupported query: ${this.table} ${this.op}`) };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  private async buildCompatBody(uid: string | undefined): Promise<Record<string, unknown> | null> {
    const t = this.table;
    if (!uid && t !== "profiles" && t !== "community_posts" && t !== "learning_guides") return null;

    if (t === "profiles" && this.op === "select") {
      const ids = this.filters.find((f): f is Extract<Filter, { type: "in" }> => f.type === "in" && f.column === "id");
      if (ids && ids.type === "in") {
        return { action: "select", table: "profiles", ids: ids.value };
      }
      const id = this.getEq("id");
      if (id && this.expectOne) {
        const { res, body } = await apiJson(`/v1/profiles/${id}`);
        if (!res.ok) return null;
        return { __inline: true, data: (body as { data: unknown }).data };
      }
    }

    if (t === "community_posts" && this.op === "select") {
      if (this.getEq("status") === "active" && this.getEq("category")) {
        return { action: "select", table: "community_posts", mode: "active_category", category: this.getEq("category"), user_id: uid };
      }
      if (this.getEq("status") === "active" && this.getEq("user_id") === uid) {
        return { action: "select", table: "community_posts", mode: "by_user", user_id: uid };
      }
      if (this.getEq("status") === "active") {
        return { action: "select", table: "community_posts", mode: "active_latest", user_id: uid };
      }
      const id = this.getEq("id");
      if (id && this.expectOne) {
        return { action: "select", table: "community_posts", mode: "by_id", id, user_id: uid };
      }
    }

    if (t === "shops" && this.op === "select" && this.expectOne) {
      const userId = this.getEq("user_id");
      if (userId) {
        const { res, body } = await apiJson(`/v1/marketplace/shops/by-user/${userId}`);
        if (!res.ok) return null;
        return { __inline: true, data: (body as { data: unknown }).data };
      }
    }

    return null;
  }
}

function from(table: string) {
  return new QueryBuilder(table);
}

let realtimeClient: SupabaseClient | null = null;
function getRealtimeClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!realtimeClient) {
    realtimeClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return realtimeClient;
}

function noopChannel() {
  return {
    on() {
      return this;
    },
    subscribe() {
      return this;
    },
    unsubscribe() {
      return Promise.resolve("ok");
    },
  };
}

export const api = {
  from,
  channel: (name: string) => {
    const client = getRealtimeClient();
    if (!client) return noopChannel();
    return client.channel(name);
  },
  removeChannel: (channel?: RealtimeChannel | { unsubscribe?: () => unknown }) => {
    const client = getRealtimeClient();
    if (client && channel) {
      return client.removeChannel(channel as RealtimeChannel);
    }
    channel?.unsubscribe?.();
    return Promise.resolve("ok");
  },
  auth: {
    async getSession() {
      const s = readSession();
      return { data: { session: s as unknown }, error: null };
    },
    onAuthStateChange(callback: (event: string, session: AppSession | null) => void) {
      const run = () => {
        const s = readSession();
        callback("INITIAL_SESSION", s as unknown);
      };
      queueMicrotask(run);
      const fn = () => {
        const s = readSession();
        callback("SIGNED_IN", s as unknown);
      };
      window.addEventListener("farmbondhu:auth", fn);
      return {
        data: {
          subscription: {
            unsubscribe: () => window.removeEventListener("farmbondhu:auth", fn),
          },
        },
      };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const { res, body } = await apiJson("/v1/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return { data: { session: null, user: null }, error: { message: messageFromApiJson(body, res, "Sign-in failed.") } };
      const b = body as Record<string, unknown>;
      const nested = b.session as AppSession | undefined;
      const access_token = (nested?.access_token || b.access_token) as string;
      const refresh_token = (nested?.refresh_token || b.refresh_token) as string;
      if (!access_token || !refresh_token) {
        return { data: { session: null, user: null }, error: { message: "Invalid sign-in response from server (missing tokens)" } };
      }
      const userRaw = (nested?.user || b.user) as { id?: string; email?: string } | undefined;
      const expIn = (b.expires_in || (b.session as { expires_in?: number })?.expires_in) as number | undefined;
      const merged: AppSession = {
        access_token,
        refresh_token,
        expires_at: expIn ? Math.floor(Date.now() / 1000) + expIn : nested?.expires_at,
        user: { id: userRaw?.id || "", email: userRaw?.email },
      };
      writeSession(merged);
      return { data: { session: merged as unknown, user: merged.user }, error: null };
    },
    /** Sends a 6-digit code via Brevo SMTP; complete with `verifyRegistrationOtp`. */
    async sendRegistrationOtp(payload: {
      email: string;
      password: string;
      data?: Record<string, unknown>;
    }) {
      const { res, body } = await apiJson("/v1/auth/register/send-otp", {
        method: "POST",
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          data: payload.data || {},
        }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return { error: { message: messageFromApiJson(body, res, "Could not send verification code.") } };
      return { error: null };
    },
    async resendRegistrationOtp(email: string) {
      const { res, body } = await apiJson("/v1/auth/register/resend-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return { error: { message: messageFromApiJson(body, res, "Could not resend code.") } };
      return { error: null };
    },
    /** Verifies OTP, creates the account in Postgres, returns JWT session + persists tokens. */
    async verifyRegistrationOtp(payload: { email: string; otp: string }) {
      const { res, body } = await apiJson("/v1/auth/register/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email: payload.email, otp: payload.otp }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return { data: { session: null, user: null }, error: { message: messageFromApiJson(body, res, "Verification failed.") } };
      const b = body as Record<string, unknown>;
      const nested = b.session as AppSession | undefined;
      const access_token = (nested?.access_token || b.access_token) as string | undefined;
      if (!access_token) {
        return {
          data: { session: null, user: null },
          error: b.message ? { message: String(b.message) } : { message: "No session returned after verification." },
        };
      }
      const refresh_token = (nested?.refresh_token || b.refresh_token) as string;
      if (!refresh_token) {
        return { data: { session: null, user: null }, error: { message: "Invalid response (missing refresh token)" } };
      }
      const userRaw = (nested?.user || b.user) as { id?: string; email?: string } | undefined;
      const expIn = (b.expires_in || (b.session as { expires_in?: number })?.expires_in) as number | undefined;
      const merged: AppSession = {
        access_token,
        refresh_token,
        expires_at: expIn ? Math.floor(Date.now() / 1000) + expIn : nested?.expires_at,
        user: { id: userRaw?.id || "", email: userRaw?.email },
      };
      writeSession(merged);
      return { data: { session: merged as unknown, user: merged.user }, error: null };
    },
    async signOut() {
      const s = readSession();
      if (s?.access_token) {
        await apiJson("/v1/auth/sign-out", {
          method: "POST",
          headers: { Authorization: `Bearer ${s.access_token}` },
        });
      }
      writeSession(null);
      return { error: null };
    },
    /** Sends a 6-digit reset code via Brevo SMTP (same response whether or not the email exists). */
    async sendPasswordResetOtp(email: string) {
      const { res, body } = await apiJson("/v1/auth/recover/send-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return { error: { message: messageFromApiJson(body, res, "Could not send reset code.") } };
      return { error: null };
    },
    async resendPasswordResetOtp(email: string) {
      const { res, body } = await apiJson("/v1/auth/recover/resend-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return { error: { message: messageFromApiJson(body, res, "Could not resend code.") } };
      return { error: null };
    },
    async verifyPasswordResetOtp(payload: { email: string; otp: string; newPassword: string }) {
      const { res, body } = await apiJson("/v1/auth/recover/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          email: payload.email,
          otp: payload.otp,
          new_password: payload.newPassword,
        }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return { error: { message: messageFromApiJson(body, res, "Password reset failed.") } };
      return { error: null };
    },
    async getUser() {
      const s = readSession();
      if (!s?.access_token) return { data: { user: null }, error: null };
      return { data: { user: { id: s.user.id, email: s.user.email } }, error: null };
    },
    async updateUser(attrs: { password?: string }) {
      const s = readSession();
      if (!s?.access_token) return { error: { message: "No session" } };
      const { res, body } = await apiJson("/v1/auth/user", {
        method: "PUT",
        body: JSON.stringify(attrs),
        headers: { Authorization: `Bearer ${s.access_token}` },
      });
      if (!res.ok) return { error: { message: messageFromApiJson(body, res, "Update failed.") } };
      return { data: body, error: null };
    },
  },
};
