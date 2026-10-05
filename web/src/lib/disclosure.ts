// Minimal disclosure (SPEC-v2 §3.1).
//
// Replaces direct identifiers in the prepared text with typed, numbered
// placeholders BEFORE anything is hashed, encrypted or committed. Only the
// redacted text ever leaves this function's caller.
//
// The placeholder → original mapping is deliberately NOT returned: there is
// no way to "un-redact" later from anything this module produces. If a
// policy allows full disclosure, the caller simply skips redaction.
//
// Rule-based and deterministic on purpose: it is auditable, unit-testable and
// runs without sending the text to any model. It is not exhaustive — names in
// free text, for example, are out of scope for Phase 1 and are covered by the
// re-identification check + human approval instead (see reid-check.ts).

export type RedactionCategory =
  | "EMAIL"
  | "URL"
  | "PHONE"
  | "ID_NUMBER"
  | "POSTAL_CODE"
  | "DATE";

export type RedactionSummary = Record<RedactionCategory, number>;

export type RedactionResult = {
  redactedText: string;
  summary: RedactionSummary;
  /** Total number of distinct values replaced. */
  totalRedacted: number;
};

// Order matters: more specific / longer patterns run first so, e.g., a
// 12-digit ID number is not half-eaten by the phone pattern, and an email's
// domain is not treated as a URL.
const RULES: { category: RedactionCategory; pattern: RegExp }[] = [
  { category: "EMAIL", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { category: "URL", pattern: /\bhttps?:\/\/[^\s]+/gi },
  // A number printed after an ID label: 保険証番号12345678, マイナンバー: 1234-5678-9012.
  // Only the number is replaced; the label stays so the reader knows what it was.
  {
    category: "ID_NUMBER",
    pattern: /(?<=(?:保険証番号|マイナンバー|個人番号)(?:は|[\s:：])*)\d(?:[\d -]{0,18}\d)?(?![\d-])/g,
  },
  // 12-digit numbers (Japanese My Number format), grouped 4-4-4 or not.
  // Lookarounds forbid a digit or hyphen on either side, so the number cannot
  // start or end inside a phone number or a date. The separator must be the
  // same both times ("1234 5678 9012" or "1234-5678-9012", never mixed).
  { category: "ID_NUMBER", pattern: /(?<![\d-])\d{4}([ -]?)\d{4}\1\d{4}(?![\d-])/g },
  // Dates: 2026-09-30, 2026/9/30, 1980年4月5日, 平成5年3月4日, 5/4/1980.
  {
    category: "DATE",
    pattern:
      /(?<!\d)(?:\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?|(?:令和|平成|昭和|大正|明治)\d{1,2}年\d{1,2}月\d{1,2}日?|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})(?!\d)/g,
  },
  // Phone numbers: JP with hyphens (090-1234-5678, 03-1234-5678, 0120-12-3456)
  // or without (09012345678), and international (+81 90 1234 5678, +1 (555) 123-4567).
  {
    category: "PHONE",
    pattern:
      /\+\d{1,3}(?:[ -]?\(\d{1,4}\))?(?:[ -]\d{1,4}){2,4}(?!\d)|(?<![\d-])0\d{1,4}-\d{1,4}-\d{3,4}(?![\d-])|(?<![\d])(?:\(\d{1,4}\)[ -]?)?\d{2,4}[ -]\d{2,4}[ -]\d{3,4}(?!\d)|(?<!\d)0\d{9,10}(?!\d)/g,
  },
  // Japanese postal codes: 〒105-0001 or 105-0001.
  { category: "POSTAL_CODE", pattern: /〒?\s?(?<!\d)\d{3}-\d{4}(?!\d)/g },
];

export const REDACTION_CATEGORIES: RedactionCategory[] = RULES.map((r) => r.category);

function emptySummary(): RedactionSummary {
  return { EMAIL: 0, URL: 0, PHONE: 0, ID_NUMBER: 0, POSTAL_CODE: 0, DATE: 0 };
}

export function redact(text: string): RedactionResult {
  const summary = emptySummary();
  let working = text;

  // One numbering per category, shared by all rules of that category. Without
  // this, two ID rules would both emit [ID_NUMBER_1] for different values.
  const seenByCategory = new Map<RedactionCategory, Map<string, string>>();

  for (const { category, pattern } of RULES) {
    const seen = seenByCategory.get(category) ?? new Map<string, string>();
    seenByCategory.set(category, seen);
    // Same value → same placeholder, so the reader can still tell that two
    // mentions refer to the same (hidden) thing.
    working = working.replace(pattern, (match) => {
      const key = match.trim();
      let placeholder = seen.get(key);
      if (!placeholder) {
        placeholder = `[${category}_${seen.size + 1}]`;
        seen.set(key, placeholder);
      }
      return placeholder;
    });
    summary[category] = seen.size;
  }

  const totalRedacted = Object.values(summary).reduce((a, b) => a + b, 0);
  return { redactedText: working, summary, totalRedacted };
}
