import { describe, it, expect } from "vitest";
import { parseCsvLine, num } from "@/lib/data";

describe("parseCsvLine", () => {
  it("parses simple comma-separated values", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields containing commas", () => {
    expect(parseCsvLine('"Smith, Jr.",NYY,OF')).toEqual(["Smith, Jr.", "NYY", "OF"]);
  });

  it("handles empty fields", () => {
    expect(parseCsvLine("a,,c")).toEqual(["a", "", "c"]);
  });

  it("handles a single field", () => {
    expect(parseCsvLine("solo")).toEqual(["solo"]);
  });

  it("handles empty string", () => {
    expect(parseCsvLine("")).toEqual([""]);
  });

  it("handles trailing comma", () => {
    expect(parseCsvLine("a,b,")).toEqual(["a", "b", ""]);
  });
});

describe("num", () => {
  it("parses valid numbers", () => {
    expect(num("42")).toBe(42);
    expect(num("3.14")).toBe(3.14);
    expect(num("-1.5")).toBe(-1.5);
    expect(num("0")).toBe(0);
  });

  it("returns undefined for undefined input", () => {
    expect(num(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(num("")).toBeUndefined();
  });

  it("returns undefined for lowercase 'nan'", () => {
    expect(num("nan")).toBeUndefined();
  });

  it("returns undefined for 'NaN'", () => {
    expect(num("NaN")).toBeUndefined();
  });

  it("returns undefined for non-numeric strings", () => {
    expect(num("abc")).toBeUndefined();
  });

  it("handles Infinity string", () => {
    const result = num("Infinity");
    expect(result).toBe(Infinity);
  });

  it("handles negative Infinity string", () => {
    const result = num("-Infinity");
    expect(result).toBe(-Infinity);
  });

  it("parses scientific notation", () => {
    expect(num("1e3")).toBe(1000);
  });

  it("parses leading zeros", () => {
    expect(num("007")).toBe(7);
  });
});
