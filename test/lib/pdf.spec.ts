import { describe, it, expect } from "vitest";
import { tokenize, chunkText, buildInverted, scoreChunks, expandContext, highlight, Index } from "../../src/lib/pdf.js";

describe("tokenize", () => {
  it("lowercases, keeps unicode letters and hyphens", () => {
    expect(tokenize("Neutral Citation – R v Smith 2020"))
      .toEqual(["neutral", "citation", "r", "v", "smith", "2020"]);
  });
});

describe("chunkText with page markers and coalescing", () => {
  const sample = [
    "<<<PAGE:10>>>",
    "2.3.1 Decisions with a Medium Neutral Citation",
    "Rule",
    "Unreported decisions with a medium neutral citation (a citation system that does not depend on publisher or medium) should be cited as shown above.",
    "Example",
    "Quarmby v Keating [2009] TASSC 80, [11]",
    "<<<PAGE:11>>>",
    "2.3.2 Decisions without a Medium Neutral Citation",
    "Rule",
    "Unreported decisions without a medium neutral citation allocated by the court should be cited as shown above.",
  ].join("\n");

  it("assigns pages and groups adjacent paras into ~1000 char chunks", () => {
    const chunks = chunkText(sample, { maxLen: 300 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].page).toBe(10);
    expect(chunks[0].text).toMatch(/2\.3\.1/);
    // Ensure body text is coalesced with heading
    const combined = chunks.map((c) => c.text).join(" ");
    expect(combined).toMatch(/Unreported decisions with a medium neutral citation/);
    // Page should switch for later chunks
    expect(chunks.some((c) => c.page === 11)).toBe(true);
  });
});

describe("index + score + context expansion", () => {
  it("scores overlapping tokens and expands context", () => {
    const text = [
      "<<<PAGE:5>>>",
      "2.2.2 Law Report Series",
      "Rule",
      "The authorised version of the report should always be used where available.",
      "Examples",
      "CLR, FCR, VR, NSWLR",
    ].join("\n");
    const chunks = chunkText(text, { maxLen: 200 });
    const inverted = buildInverted(chunks);
    const index: Index = { chunks, inverted };
    const results = scoreChunks("authorised report", index);
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    const ctx = expandContext(index, top.chunk.id, { before: 1, after: 2, budget: 500 });
    // Context should include surrounding headings/examples for richer preview
    expect(ctx.text).toMatch(/Law Report Series/);
    expect(ctx.text).toMatch(/authorised version/);
  });
});

describe("highlight and phrase boost", () => {
  it("wraps matched tokens in brackets", () => {
    const text = "This rule explains medium neutral citation usage";
    const out = highlight(text, "neutral citation");
    expect(out).toMatch(/\[neutral\]/i);
    expect(out).toMatch(/\[citation\]/i);
  });

  it("boosts exact phrase over token-only match", () => {
    const lines = [
      "<<<PAGE:1>>>",
      "Heading",
      "This contains the exact phrase neutral citation in one place repeated neutral citation to lengthen the text.",
      "<<<PAGE:1>>>",
      "Other section",
      "This has the word neutral and also the word citation but not together anywhere in this section despite repetition of neutral and citation terms.",
    ].join("\n");
    const chunks = chunkText(lines, { maxLen: 100 });
    const inverted = buildInverted(chunks);
    const index: Index = { chunks, inverted };
    const results = scoreChunks("neutral citation", index);
    expect(results.length).toBeGreaterThan(1);
    // Expect the chunk including exact substring to rank first
    const topText = results[0].chunk.text.toLowerCase();
    expect(topText.includes("neutral citation")).toBe(true);
  });
});
