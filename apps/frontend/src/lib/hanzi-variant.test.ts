import { describe, it, expect } from "vitest";
import { convertHanzi } from "./hanzi-variant";

describe("convertHanzi", function convertHanziDescribe() {
  it("returns the input untouched for the original variant", function originalUntouched() {
    expect(convertHanzi("汉语", "original")).toBe("汉语");
    expect(convertHanzi("漢語", "original")).toBe("漢語");
  });

  it("converts Simplified input to Traditional", function simplifiedToTraditional() {
    expect(convertHanzi("汉语", "traditional")).toBe("漢語");
    expect(convertHanzi("简体字", "traditional")).toBe("簡體字");
  });

  it("converts Traditional input to Simplified", function traditionalToSimplified() {
    expect(convertHanzi("漢語", "simplified")).toBe("汉语");
    expect(convertHanzi("簡體字", "simplified")).toBe("简体字");
  });

  it("leaves text that is already in the target variant unchanged", function idempotentConversion() {
    expect(convertHanzi("汉语", "simplified")).toBe("汉语");
    expect(convertHanzi("漢語", "traditional")).toBe("漢語");
  });

  it("passes punctuation and ASCII through unchanged in every variant", function punctuationUnchanged() {
    expect(convertHanzi("，世界！", "traditional")).toBe("，世界！");
    expect(convertHanzi("Hello, 汉语!", "simplified")).toBe("Hello, 汉语!");
  });

  it("handles the empty string without throwing", function emptyString() {
    expect(convertHanzi("", "simplified")).toBe("");
    expect(convertHanzi("", "traditional")).toBe("");
  });
});
