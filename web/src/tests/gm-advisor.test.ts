import { describe, it, expect } from "vitest";
import { parseGmTierJson } from "@/app/gm/roster/page";

describe("parseGmTierJson", () => {
  it("parses valid tier JSON with bullets and generatedAt", () => {
    const raw = {
      bullets: ["Do X", "Do Y"],
      generatedAt: "2026-04-28T12:00:00.000Z",
    };
    const result = parseGmTierJson(raw);
    expect(result).toEqual({
      bullets: ["Do X", "Do Y"],
      generatedAt: "2026-04-28T12:00:00.000Z",
    });
  });

  it("returns null for null input", () => {
    expect(parseGmTierJson(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseGmTierJson(undefined)).toBeNull();
  });

  it("returns null for non-object input (string)", () => {
    expect(parseGmTierJson("string")).toBeNull();
  });

  it("returns null for non-object input (number)", () => {
    expect(parseGmTierJson(42)).toBeNull();
  });

  it("returns null for non-object input (boolean)", () => {
    expect(parseGmTierJson(true)).toBeNull();
  });

  it("returns null when bullets is missing", () => {
    expect(parseGmTierJson({ generatedAt: "2026-01-01" })).toBeNull();
  });

  it("returns null when bullets is not an array", () => {
    expect(parseGmTierJson({ bullets: "not an array" })).toBeNull();
  });

  it("returns null when bullets array is empty", () => {
    expect(parseGmTierJson({ bullets: [] })).toBeNull();
  });

  it("filters out non-string and empty-string bullets", () => {
    const raw = { bullets: ["Valid", "", 42, null, "Also valid"] };
    const result = parseGmTierJson(raw);
    expect(result).toEqual({
      bullets: ["Valid", "Also valid"],
      generatedAt: null,
    });
  });

  it("returns null when all bullets are invalid", () => {
    expect(parseGmTierJson({ bullets: ["", null, 42] })).toBeNull();
  });

  it("sets generatedAt to null when missing", () => {
    const result = parseGmTierJson({ bullets: ["Do X"] });
    expect(result?.generatedAt).toBeNull();
  });

  it("sets generatedAt to null when not a string", () => {
    const result = parseGmTierJson({ bullets: ["Do X"], generatedAt: 12345 });
    expect(result?.generatedAt).toBeNull();
  });

  it("handles extra fields without error", () => {
    const raw = {
      bullets: ["A"],
      generatedAt: "2026-01-01",
      extra: "ignored",
    };
    const result = parseGmTierJson(raw);
    expect(result).toEqual({
      bullets: ["A"],
      generatedAt: "2026-01-01",
    });
  });

  it("handles single valid bullet among many invalid", () => {
    const raw = { bullets: [null, undefined, 0, false, "Only valid one", ""] };
    const result = parseGmTierJson(raw);
    expect(result).toEqual({
      bullets: ["Only valid one"],
      generatedAt: null,
    });
  });
});
