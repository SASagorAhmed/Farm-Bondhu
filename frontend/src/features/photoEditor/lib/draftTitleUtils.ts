import type { DesignDraft } from "../types";
import type { LocalPhotoEditorDraft } from "./localDraftKeys";

/** Matches "Untitled", "Untitled design", "Untitled 1", "Untitled design 2", etc. */
const UNTITLED_RE = /^untitled(?: design)?(?: (\d+))?$/i;

export function normalizeDraftTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

export function isGenericUntitledTitle(title: string): boolean {
  const normalized = normalizeDraftTitle(title);
  if (!normalized) return true;
  return UNTITLED_RE.test(normalized);
}

/** Returns 1-based slot number for generic untitled names, or null if not an untitled pattern. */
export function parseUntitledNumber(title: string): number | null {
  const normalized = normalizeDraftTitle(title);
  const match = normalized.match(UNTITLED_RE);
  if (!match) return null;
  if (match[1] === undefined) return 1;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatUntitledDraftName(n: number, t: (key: string) => string): string {
  return t("seller.photoEditor.untitledDraftName").replace("{n}", String(n));
}

export function proposeNextUntitledTitle(
  existingTitles: string[],
  t: (key: string) => string,
): string {
  let max = 0;
  for (const raw of existingTitles) {
    const num = parseUntitledNumber(raw);
    if (num !== null) max = Math.max(max, num);
  }
  return formatUntitledDraftName(max + 1, t);
}

export function isDraftTitleTaken(
  title: string,
  existingTitles: string[],
  excludeNormalizedTitle?: string,
): boolean {
  const norm = normalizeDraftTitle(title).toLowerCase();
  if (!norm) return false;
  const exclude = excludeNormalizedTitle?.toLowerCase();
  for (const raw of existingTitles) {
    const other = normalizeDraftTitle(raw).toLowerCase();
    if (!other) continue;
    if (exclude && other === exclude) continue;
    if (other === norm) return true;
  }
  return false;
}

export function collectExistingTitles(options: {
  cloudDrafts: DesignDraft[];
  localDrafts: LocalPhotoEditorDraft[];
  excludeDraftId?: string | null;
}): string[] {
  const titles: string[] = [];
  const exclude = options.excludeDraftId;

  for (const d of options.cloudDrafts) {
    if (exclude && d.id === exclude) continue;
    if (d.title?.trim()) titles.push(d.title);
  }
  for (const d of options.localDrafts) {
    if (exclude && d.draftId === exclude) continue;
    if (d.title?.trim()) titles.push(d.title);
  }
  return titles;
}

/** Assign next Untitled N when the user has not chosen a custom name. */
export function resolveTitleForSave(
  rawTitle: string,
  existingTitles: string[],
  t: (key: string) => string,
): string {
  if (!isGenericUntitledTitle(rawTitle)) {
    const normalized = normalizeDraftTitle(rawTitle);
    return normalized || proposeNextUntitledTitle(existingTitles, t);
  }
  return proposeNextUntitledTitle(existingTitles, t);
}
