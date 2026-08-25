import OpenCC from "opencc-js";

/**
 * The character-script variant in which the parsed hanzi are displayed
 * in the results view.
 * - `"original"` — show the hanzi exactly as returned by the parser.
 * - `"simplified"` — convert the hanzi to Simplified Chinese.
 * - `"traditional"` — convert the hanzi to Traditional Chinese.
 */
export type HanziVariant = "original" | "simplified" | "traditional";

/**
 * Converter from any Chinese text to Simplified Chinese (Mainland
 * China). The `from` locale is `"t"` (generic Traditional) because the
 * t→cn pipeline maps already-Simplified characters to themselves, so
 * it is safe regardless of whether the user's input was Simplified or
 * Traditional. Created once at module load since the dictionary data
 * is immutable and converter construction is relatively expensive.
 */
const toSimplifiedConverter = OpenCC.Converter({ from: "t", to: "cn" });

/**
 * Converter from any Chinese text to Traditional Chinese (Taiwan).
 * The `from` locale is `"cn"` because the cn→tw pipeline maps already-
 * Traditional characters to themselves, so it is safe regardless of
 * whether the user's input was Simplified or Traditional. Created once
 * at module load for the same reason as `toSimplifiedConverter`.
 */
const toTraditionalConverter = OpenCC.Converter({ from: "cn", to: "tw" });

/**
 * Converts a hanzi string into the requested character variant using
 * OpenCC. Punctuation and non-CJK characters pass through unchanged,
 * and converting text that is already in the target variant is a
 * no-op, so this function is always safe to call.
 *
 * Steps:
 * 1. Return the input untouched for the `"original"` variant (no
 *    conversion is performed at all).
 * 2. Otherwise run the prebuilt OpenCC converter matching the chosen
 *    variant over the whole string.
 *
 * @param hanzi - The original hanzi string (may contain punctuation).
 * @param variant - The target character variant.
 * @returns The hanzi string converted to the requested variant.
 */
export function convertHanzi(hanzi: string, variant: HanziVariant): string {
  if (variant === "original") {
    return hanzi;
  }

  return variant === "simplified"
    ? toSimplifiedConverter(hanzi)
    : toTraditionalConverter(hanzi);
}
