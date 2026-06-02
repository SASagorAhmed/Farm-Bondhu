import test from "node:test";
import assert from "node:assert/strict";
import { invalidateByPrefix, getCachedValue, setCachedValue } from "../services/responseCache.js";
import { invalidateMarketplaceProductCache, MARKETPLACE_CACHE_PREFIX } from "../lib/marketplaceProductCache.js";

test("invalidateMarketplaceProductCache clears anon product keys", () => {
  setCachedValue(`${MARKETPLACE_CACHE_PREFIX}|u:anon|products|x`, [{ id: "1" }], 60_000);
  setCachedValue(`${MARKETPLACE_CACHE_PREFIX}|u:anon|product|p1`, { id: "p1" }, 60_000);
  setCachedValue(`${MARKETPLACE_CACHE_PREFIX}|u:seller-1|products`, [], 60_000);

  invalidateMarketplaceProductCache("seller-1", ["p1"]);

  assert.equal(getCachedValue(`${MARKETPLACE_CACHE_PREFIX}|u:anon|products|x`), null);
  assert.equal(getCachedValue(`${MARKETPLACE_CACHE_PREFIX}|u:anon|product|p1`), null);
  assert.equal(getCachedValue(`${MARKETPLACE_CACHE_PREFIX}|u:seller-1|products`), null);
});

test("invalidateByPrefix removes matching keys only", () => {
  setCachedValue("other|u:anon|products", true, 60_000);
  setCachedValue(`${MARKETPLACE_CACHE_PREFIX}|u:anon|products|y`, true, 60_000);
  invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|u:anon|products`);
  assert.equal(getCachedValue("other|u:anon|products"), true);
  assert.equal(getCachedValue(`${MARKETPLACE_CACHE_PREFIX}|u:anon|products|y`), null);
});
