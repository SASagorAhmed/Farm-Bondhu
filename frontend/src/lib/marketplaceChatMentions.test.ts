import { describe, expect, it } from "vitest";
import {
  containsProductMention,
  containsReportMention,
  detectNewlyCompletedMentionTag,
  filterMentionTags,
  findActiveMentionQuery,
  getChatMentionTags,
  insertMentionTag,
  MARKETPLACE_CHAT_MENTION_TAGS,
  messageTextForSend,
  splitTextWithMentionTags,
  stripAllMentionTags,
  stripProductMention,
} from "@/lib/marketplaceChatMentions";

describe("marketplaceChatMentions", () => {
  it("detects @product anywhere in message", () => {
    expect(containsProductMention("hello @product")).toBe(true);
    expect(containsProductMention("@product what is the price?")).toBe(true);
    expect(containsProductMention("check @product thanks")).toBe(true);
    expect(containsProductMention("@PRODUCT")).toBe(true);
    expect(containsProductMention("hello")).toBe(false);
  });

  it("detects @report anywhere in message", () => {
    expect(containsReportMention("hello @report")).toBe(true);
    expect(containsReportMention("@report please help")).toBe(true);
    expect(containsReportMention("@REPORT")).toBe(true);
    expect(containsReportMention("hello")).toBe(false);
  });

  it("strips @product token and collapses whitespace", () => {
    expect(stripProductMention("Is this available? @product")).toBe("Is this available?");
    expect(stripProductMention("@product what is the price?")).toBe("what is the price?");
    expect(stripProductMention("@product")).toBe("");
    expect(stripAllMentionTags("hello @product world")).toBe("hello world");
  });

  it("strips @report token", () => {
    expect(stripAllMentionTags("please @report")).toBe("please");
    expect(stripAllMentionTags("@report")).toBe("");
    expect(stripAllMentionTags("hi @product and @report")).toBe("hi and");
  });

  it("messageTextForSend returns empty when only mention", () => {
    expect(messageTextForSend("@product")).toBe("");
    expect(messageTextForSend("hello @product")).toBe("hello");
    expect(messageTextForSend("@report")).toBe("");
  });

  it("findActiveMentionQuery at cursor", () => {
    expect(findActiveMentionQuery("hello @", 7)).toEqual({ query: "", start: 6, end: 7 });
    expect(findActiveMentionQuery("hello @p", 8)).toEqual({ query: "p", start: 6, end: 8 });
    expect(findActiveMentionQuery("hello @product", 14)).toBeNull();
    expect(findActiveMentionQuery("hello @report", 13)).toBeNull();
    expect(findActiveMentionQuery("email@test.com", 5)).toBeNull();
  });

  it("filterMentionTags by prefix", () => {
    expect(filterMentionTags("")).toEqual(MARKETPLACE_CHAT_MENTION_TAGS);
    expect(filterMentionTags("p")).toHaveLength(1);
    expect(filterMentionTags("p")[0]?.id).toBe("product");
    expect(filterMentionTags("r")).toHaveLength(1);
    expect(filterMentionTags("r")[0]?.id).toBe("report");
    expect(filterMentionTags("order")).toHaveLength(0);
  });

  it("getChatMentionTags excludes report when allowReport is false", () => {
    expect(getChatMentionTags({ allowReport: false }).map((t) => t.id)).toEqual(["product"]);
    expect(getChatMentionTags().map((t) => t.id)).toEqual(["product", "report"]);
  });

  it("insertMentionTag replaces partial token", () => {
    const tag = MARKETPLACE_CHAT_MENTION_TAGS[0];
    const { text, cursor } = insertMentionTag("hi @p", { start: 3, end: 5 }, tag);
    expect(text).toBe("hi @product ");
    expect(cursor).toBe(12);
  });

  it("detectNewlyCompletedMentionTag on manual typing", () => {
    expect(detectNewlyCompletedMentionTag("hello @produc", "hello @product", "product")).toBe(true);
    expect(detectNewlyCompletedMentionTag("hello @product", "hello @product ", "product")).toBe(false);
    expect(detectNewlyCompletedMentionTag("", "@product", "product")).toBe(true);
    expect(detectNewlyCompletedMentionTag("hello @repor", "hello @report", "report")).toBe(true);
  });

  it("splitTextWithMentionTags colors only complete tags", () => {
    expect(splitTextWithMentionTags("hello @product world")).toEqual([
      { type: "text", value: "hello " },
      { type: "tag", value: "@product", tagId: "product" },
      { type: "text", value: " world" },
    ]);
    expect(splitTextWithMentionTags("typing @pro")).toEqual([{ type: "text", value: "typing @pro" }]);
    expect(splitTextWithMentionTags("@report help")).toEqual([
      { type: "tag", value: "@report", tagId: "report" },
      { type: "text", value: " help" },
    ]);
  });
});
