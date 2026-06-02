/** Strip query/hash and trailing slashes from a nav URL for pathname comparison. */
export function normalizeNavPath(url: string): string {
  const path = url.split("?")[0].split("#")[0];
  return path.replace(/\/+$/, "") || "/";
}

function parseNavQuery(url: string): URLSearchParams {
  const idx = url.indexOf("?");
  if (idx < 0) return new URLSearchParams();
  return new URLSearchParams(url.slice(idx + 1));
}

function hasQueryParams(params: URLSearchParams): boolean {
  return [...params.keys()].length > 0;
}

function queryParamsMatch(navParams: URLSearchParams, search: string): boolean {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const current = new URLSearchParams(raw);
  for (const [key, value] of navParams.entries()) {
    if (current.get(key) !== value) return false;
  }
  return true;
}

function siblingMatches(
  pathname: string,
  search: string,
  itemUrl: string,
  siblingUrls: string[],
): boolean {
  const path = normalizeNavPath(itemUrl);
  const normPathname = normalizeNavPath(pathname);

  if (path === "/admin") {
    return normPathname === "/admin";
  }

  const pathMatches =
    normPathname === path || normPathname.startsWith(`${path}/`);
  if (!pathMatches) return false;

  const itemQuery = parseNavQuery(itemUrl);
  if (hasQueryParams(itemQuery)) {
    return queryParamsMatch(itemQuery, search);
  }

  if (normPathname === path) {
    const querySiblingWins = siblingUrls.some((sibling) => {
      if (sibling === itemUrl) return false;
      const siblingPath = normalizeNavPath(sibling);
      if (siblingPath !== path) return false;
      const siblingQuery = parseNavQuery(sibling);
      if (!hasQueryParams(siblingQuery)) return false;
      return queryParamsMatch(siblingQuery, search);
    });
    if (querySiblingWins) return false;
  }

  return true;
}

/**
 * True when this nav item is the best match among siblings (longest path wins;
 * query-specific items beat path-only hubs on the same path).
 */
export function isAdminNavItemActive(
  pathname: string,
  search: string,
  itemUrl: string,
  siblingUrls: string[],
): boolean {
  const matching = siblingUrls.filter((url) =>
    siblingMatches(pathname, search, url, siblingUrls),
  );
  if (!matching.includes(itemUrl)) return false;

  const longestLen = Math.max(
    ...matching.map((url) => normalizeNavPath(url).length),
  );
  const itemLen = normalizeNavPath(itemUrl).length;
  if (itemLen < longestLen) return false;

  return matching.some(
    (url) => normalizeNavPath(url).length === longestLen && url === itemUrl,
  );
}
