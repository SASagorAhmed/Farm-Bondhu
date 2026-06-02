import { invalidateByPrefix } from "../services/responseCache.js";

export const MARKETPLACE_CACHE_PREFIX = "marketplace";

/**
 * Bust marketplace product list/detail caches after stock changes.
 * @param {string} [sellerId]
 * @param {string[]} [productIds]
 */
export function invalidateMarketplaceProductCache(sellerId, productIds = []) {
  invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|u:anon|products`);
  invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|u:anon|product`);
  if (sellerId) {
    invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|u:${sellerId}|`);
  }
  for (const productId of productIds) {
    if (productId) {
      invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|u:anon|product|${productId}`);
    }
  }
}
