// Re-identification check (SPEC-v2 §3.2).
//
// After direct identifiers are redacted, a record can still point to one
// person through a combination of "quasi-identifiers" — an exact age, a
// named place, a job title, a rare attribute. This module looks for those
// signals in the REDACTED text and returns a bounded 0–100 score.
//
// Inspired by Airlock (ETHGlobal Tokyo 2026), which re-tests redacted text
// with a local model. Phase 1 uses a deterministic heuristic instead so it is
// explainable and testable without any model call. It is a screening signal
// that feeds the policy decision — NOT a privacy guarantee, and it is
// labelled that way in the UI.

export type ReidSignal =
  | "exact_age"
  | "named_place"
  | "occupation"
  | "family_detail"
  | "rare_attribute"
  | "residual_number"
  | "capitalized_name";

export type ReidAssessment = {
  score: number; // 0 (low) – 100 (high)
  signals: { signal: ReidSignal; count: number }[];
};

const WEIGHTS: Record<ReidSignal, number> = {
  exact_age: 20,
  named_place: 20,
  occupation: 12,
  family_detail: 8,
  rare_attribute: 25,
  residual_number: 6,
  capitalized_name: 10,
};

const DETECTORS: { signal: ReidSignal; pattern: RegExp }[] = [
  { signal: "exact_age", pattern: /\b\d{1,3}\s?(?:years? old|yo|y\/o)\b|\d{1,3}\s?歳/gi },
  {
    signal: "named_place",
    pattern:
      /\b(?:in|at|from|near)\s+[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b|[一-龥ぁ-んァ-ヶ]{1,6}(?:市|区|町|村|県|都|府|駅|病院|施設|学校)/g,
  },
  {
    signal: "occupation",
    pattern:
      /\b(?:nurse|teacher|doctor|carer|caregiver|police|engineer|driver|lawyer|principal|mayor)\b|看護師|教師|医師|介護士|保育士|警察官|運転手|弁護士|校長/gi,
  },
  {
    signal: "family_detail",
    pattern: /\b(?:my|her|his)\s+(?:son|daughter|wife|husband|mother|father|twins?)\b|息子|娘|妻|夫|母|父|双子/gi,
  },
  {
    signal: "rare_attribute",
    pattern: /\b(?:only|sole|first|last)\s+\w+(?:\s\w+)?\s+(?:in|at|of)\b|唯一の|たった一人の|初めての/gi,
  },
  // Numbers left after redaction (placeholders like [PHONE_1] are ignored).
  { signal: "residual_number", pattern: /(?<![_\w])\d{3,}(?![\w\]])/g },
  // Two consecutive Capitalized words that are not at a sentence start is a
  // cheap proxy for a personal name ("Taro Yamada").
  { signal: "capitalized_name", pattern: /(?<=[a-z,;]\s)[A-Z][a-z]+\s[A-Z][a-z]+\b/g },
];

export function assessReidentificationRisk(redactedText: string): ReidAssessment {
  const signals: ReidAssessment["signals"] = [];
  let raw = 0;

  for (const { signal, pattern } of DETECTORS) {
    const count = redactedText.match(pattern)?.length ?? 0;
    if (count > 0) {
      signals.push({ signal, count });
      // Diminishing returns: the first hit matters most.
      raw += WEIGHTS[signal] * (1 + Math.log2(count));
    }
  }

  // Combinations are what re-identify people: add a bonus when several
  // independent kinds of signal appear together.
  if (signals.length >= 3) raw += 15;

  const score = Math.max(0, Math.min(100, Math.round(raw)));
  return { score, signals };
}
