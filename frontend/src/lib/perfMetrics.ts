const PERF_ENABLED =
  typeof window !== "undefined" &&
  ((window as unknown as { __FB_PERF_DEBUG__?: boolean }).__FB_PERF_DEBUG__ === true ||
    import.meta.env.VITE_PERF_DEBUG === "true");

function formatMs(ms: number) {
  return `${Math.round(ms)}ms`;
}

type PerfKind = "route" | "api";
type PerfSample = {
  kind: PerfKind;
  label: string;
  duration: number;
  ts: number;
};

const SAMPLE_KEY = "farmbondhu.perf.samples.v1";
const SNAPSHOT_KEY = "farmbondhu.perf.snapshots.v1";
const SAMPLE_LIMIT = 1200;

function readSamples(): PerfSample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAMPLE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PerfSample[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSamples(samples: PerfSample[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAMPLE_KEY, JSON.stringify(samples.slice(-SAMPLE_LIMIT)));
  } catch {
    // Ignore storage failures (private mode/quota).
  }
}

function pushSample(sample: PerfSample) {
  const next = [...readSamples(), sample];
  writeSamples(next);
}

export function markRouteTransition(pathname: string) {
  if (!PERF_ENABLED || typeof performance === "undefined") return;
  performance.mark(`fb:route:start:${pathname}`);
}

export function measureRouteTransition(pathname: string) {
  if (!PERF_ENABLED || typeof performance === "undefined") return;
  const startMark = `fb:route:start:${pathname}`;
  const endMark = `fb:route:end:${pathname}`;
  const measureName = `fb:route:${pathname}`;
  try {
    performance.mark(endMark);
    performance.measure(measureName, startMark, endMark);
    const entries = performance.getEntriesByName(measureName);
    const duration = entries[entries.length - 1]?.duration;
    if (typeof duration === "number") {
      pushSample({ kind: "route", label: pathname, duration, ts: Date.now() });
      console.info(`[perf] route ${pathname}: ${formatMs(duration)}`);
    }
  } catch {
    // Ignore measurement failures in unsupported browsers.
  } finally {
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);
  }
}

export async function withApiTiming<T>(label: string, task: () => Promise<T>): Promise<T> {
  if (!PERF_ENABLED || typeof performance === "undefined") {
    return task();
  }
  const start = performance.now();
  try {
    return await task();
  } finally {
    const duration = performance.now() - start;
    pushSample({ kind: "api", label, duration, ts: Date.now() });
    console.info(`[perf] api ${label}: ${formatMs(duration)}`);
  }
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export type PerfAggregate = {
  kind: PerfKind;
  label: string;
  count: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
};

export function getPerfTopN(limit = 10): PerfAggregate[] {
  const buckets = new Map<string, PerfSample[]>();
  for (const s of readSamples()) {
    const k = `${s.kind}:${s.label}`;
    const arr = buckets.get(k) || [];
    arr.push(s);
    buckets.set(k, arr);
  }
  const all: PerfAggregate[] = [];
  for (const [k, arr] of buckets.entries()) {
    const [kind, ...rest] = k.split(":");
    const label = rest.join(":");
    const durations = arr.map((x) => x.duration).sort((a, b) => a - b);
    const sum = durations.reduce((acc, n) => acc + n, 0);
    all.push({
      kind: kind as PerfKind,
      label,
      count: durations.length,
      avgMs: sum / durations.length,
      p95Ms: percentile(durations, 95),
      maxMs: durations[durations.length - 1] || 0,
    });
  }
  return all.sort((a, b) => b.p95Ms - a.p95Ms).slice(0, limit);
}

export function printPerfTopN(limit = 10) {
  const rows = getPerfTopN(limit).map((r) => ({
    kind: r.kind,
    label: r.label,
    count: r.count,
    avg_ms: Math.round(r.avgMs),
    p95_ms: Math.round(r.p95Ms),
    max_ms: Math.round(r.maxMs),
  }));
  console.table(rows);
  return rows;
}

type SnapshotRow = ReturnType<typeof printPerfTopN>[number];
type SnapshotMap = Record<string, { at: number; rows: SnapshotRow[] }>;

function readSnapshots(): SnapshotMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SnapshotMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSnapshots(snapshots: SnapshotMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
  } catch {
    // Ignore snapshot storage failures.
  }
}

export function savePerfSnapshot(name: string, limit = 10) {
  const key = String(name || "").trim();
  if (!key) return null;
  const snapshots = readSnapshots();
  snapshots[key] = { at: Date.now(), rows: printPerfTopN(limit) };
  writeSnapshots(snapshots);
  return snapshots[key];
}

export function comparePerfSnapshots(fromName: string, toName: string) {
  const snapshots = readSnapshots();
  const from = snapshots[fromName];
  const to = snapshots[toName];
  if (!from || !to) {
    console.warn(`[perf] snapshot missing. from=${fromName} to=${toName}`);
    return [];
  }
  const fromMap = new Map(from.rows.map((r) => [`${r.kind}:${r.label}`, r]));
  const rows = to.rows.map((next) => {
    const prev = fromMap.get(`${next.kind}:${next.label}`);
    const deltaP95 = prev ? next.p95_ms - prev.p95_ms : null;
    const deltaAvg = prev ? next.avg_ms - prev.avg_ms : null;
    return {
      kind: next.kind,
      label: next.label,
      p95_ms_before: prev?.p95_ms ?? null,
      p95_ms_after: next.p95_ms,
      p95_delta_ms: deltaP95,
      avg_ms_before: prev?.avg_ms ?? null,
      avg_ms_after: next.avg_ms,
      avg_delta_ms: deltaAvg,
    };
  });
  console.table(rows);
  return rows;
}
