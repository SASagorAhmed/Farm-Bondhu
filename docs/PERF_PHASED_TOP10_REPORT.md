# Phased Top-10 Delay Report

This report documents the phased optimization workflow implemented for route/API delay reduction.

## How to capture Top-10 metrics

1. Open app with perf mode enabled:
   - set `VITE_PERF_DEBUG=true` and reload.
2. Navigate through real user flows for 5-10 minutes.
3. In browser console run:
   - `farmbondhuPerfTop10()`
4. This prints a combined top-10 table (route + api) ranked by P95.

Snapshot/compare workflow:
- Save baseline: `farmbondhuPerfSave("phase1_before")`
- Save after fixes: `farmbondhuPerfSave("phase1_after")`
- Compare: `farmbondhuPerfCompare("phase1_before", "phase1_after")`

Collected samples are persisted in `localStorage` key:
- `farmbondhu.perf.samples.v1`

## Phase 1 (Top 10) implemented focus

The first phase targeted the highest-impact observed/predicted delay patterns:

1. API latency + route timing collection (`perfMetrics` with P95 aggregation)
2. `community` list pages converted to cached query bundles
3. `marketplace` inbox/product detail cached-first refetch behavior
4. `medibondhu` consultations cached + parallel fetch
5. `admin` user management spinner/caching cleanup
6. `vet` patients cached aggregation
7. `vet` availability cached fetch + invalidate-on-save
8. backend product+shop aggregate endpoint to reduce serial calls
9. route-level lazy loading for additional heavy screens
10. query persistence/stale-window tuning for back-navigation instant feel

## Phase 2 re-baseline and repeat

After deploying Phase 1:

1. Re-run `farmbondhuPerfTop10()`
2. Build the next ranked backlog from the same output
3. Apply the same playbook to the next top contributors:
   - convert mount-fetch pages to React Query
   - reduce serial request chains
   - avoid full-screen loading for revisits
   - lazy load heavy route chunks

## Current cycle additions (chat + serverless tail)

- Added aggregate chat endpoints to collapse inbox/detail fan-out:
  - `GET /v1/marketplace/chat/inbox`
  - `GET /v1/marketplace/chat/conversations/:id/bootstrap`
  - `GET /v1/marketplace/chat/share-products`
- Updated marketplace chat screens to use these endpoints and render from cache-first query flow.
- Added serverless-friendly DB defaults in `backend/src/db.js`:
  - conservative pool max, shorter connect timeout, bounded connection max lifetime.
- Realtime invalidation now uses short debounce on high-frequency channels to avoid refetch storms.

## Re-measure checklist for this batch

1. Save pre-deploy snapshot: `farmbondhuPerfSave("route_fix_before_deploy")`
2. Deploy and warm key paths (marketplace inbox/chat, community feed, dashboard).
3. Save post-deploy snapshot: `farmbondhuPerfSave("route_fix_after_deploy")`
4. Compare deltas: `farmbondhuPerfCompare("route_fix_before_deploy", "route_fix_after_deploy")`
5. Capture ranked table: `farmbondhuPerfTop10(15)` and queue next optimization batch from top p95/p99 entries.

## Instant-navigation verification batch

Use this after the stale-while-revalidate + prefetch rollout:

1. Save baseline before rollout: `farmbondhuPerfSave("instant_nav_before")`
2. Navigate these routes repeatedly (with normal user behavior):
   - `/marketplace/inbox`
   - `/marketplace/chat/:conversationId`
   - `/dashboard`
   - `/community`
   - `/admin/users`
   - `/vet/patients`
3. Save post-rollout snapshot: `farmbondhuPerfSave("instant_nav_after")`
4. Compare p95/p99 deltas: `farmbondhuPerfCompare("instant_nav_before", "instant_nav_after")`
5. Print ranked table for the final report: `farmbondhuPerfTop10(10)`

## Instant sign-in + realtime verification batch

1. Save baseline: `farmbondhuPerfSave("instant_signin_rt_before")`
2. Validate sign-in path:
   - sign in and confirm route entry is immediate (no full-screen auth wait)
   - confirm role/capability-sensitive UI reconciles shortly after background refresh
3. Validate cross-user realtime path:
   - patient books consultation
   - vet dashboard/consultations updates without refresh
   - waiting room status changes propagate to both sides instantly
4. Save after snapshot: `farmbondhuPerfSave("instant_signin_rt_after")`
5. Compare: `farmbondhuPerfCompare("instant_signin_rt_before", "instant_signin_rt_after")`

## Validation gates

- Repeat visits render from cache without full-screen loader
- P95 for optimized route/API entries drops vs prior baseline
- build/tests/lints remain green
