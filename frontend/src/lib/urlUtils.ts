const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

export function extractAllUrls(text: string): string[] {
  return text.match(URL_REGEX) || [];
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
