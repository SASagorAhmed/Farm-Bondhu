import { describe, expect, it } from "vitest";
import {
  collectExistingTitles,
  isDraftTitleTaken,
  isGenericUntitledTitle,
  normalizeDraftTitle,
  parseUntitledNumber,
  proposeNextUntitledTitle,
  resolveTitleForSave,
} from "./draftTitleUtils";

const t = (key: string) => (key === "seller.photoEditor.untitledDraftName" ? "Untitled {n}" : key);

describe("draftTitleUtils", () => {
  it("normalizes whitespace", () => {
    expect(normalizeDraftTitle("  Summer   promo  ")).toBe("Summer promo");
  });

  it("detects generic untitled variants", () => {
    expect(isGenericUntitledTitle("")).toBe(true);
    expect(isGenericUntitledTitle("Untitled")).toBe(true);
    expect(isGenericUntitledTitle("untitled design")).toBe(true);
    expect(isGenericUntitledTitle("Untitled 2")).toBe(true);
    expect(isGenericUntitledTitle("Untitled design 3")).toBe(true);
    expect(isGenericUntitledTitle("Summer Sale")).toBe(false);
  });

  it("parses untitled numbers including gaps", () => {
    expect(parseUntitledNumber("Untitled")).toBe(1);
    expect(parseUntitledNumber("Untitled design 2")).toBe(2);
    expect(parseUntitledNumber("UNTITLED 5")).toBe(5);
    expect(parseUntitledNumber("My Banner")).toBe(null);
  });

  it("proposes next untitled from existing titles", () => {
    expect(proposeNextUntitledTitle([], t)).toBe("Untitled 1");
    expect(proposeNextUntitledTitle(["Untitled 1", "Untitled 2"], t)).toBe("Untitled 3");
    expect(proposeNextUntitledTitle(["Untitled", "Untitled design 2"], t)).toBe("Untitled 3");
    expect(proposeNextUntitledTitle(["Summer promo"], t)).toBe("Untitled 1");
  });

  it("detects duplicate titles case-insensitively", () => {
    const titles = ["Summer Promo", "Untitled 1"];
    expect(isDraftTitleTaken("summer promo", titles)).toBe(true);
    expect(isDraftTitleTaken("Summer Promo", titles, "summer promo")).toBe(false);
    expect(isDraftTitleTaken("Winter Sale", titles)).toBe(false);
  });

  it("collects titles excluding current draft", () => {
    const titles = collectExistingTitles({
      cloudDrafts: [
        { id: "a", title: "A" } as never,
        { id: "b", title: "B" } as never,
      ],
      localDrafts: [{ draftId: "local-1", title: "Local", storageKey: "k" }],
      excludeDraftId: "a",
    });
    expect(titles).toEqual(["B", "Local"]);
  });

  it("resolveTitleForSave keeps custom names and auto-numbers generic", () => {
    expect(resolveTitleForSave("My Design", ["My Design"], t)).toBe("My Design");
    expect(resolveTitleForSave("Untitled design", ["Untitled 1"], t)).toBe("Untitled 2");
    expect(resolveTitleForSave("", [], t)).toBe("Untitled 1");
  });
});
