import { describe, expect, it } from "vitest";
import { assessReidentificationRisk } from "./reid-check";
import { DEFAULT_POLICY } from "./consent-policy";

describe("assessReidentificationRisk", () => {
  it("scores generic text low", () => {
    const r = assessReidentificationRisk("I slept badly and felt anxious this week.");
    expect(r.score).toBeLessThanOrEqual(DEFAULT_POLICY.maxReidRisk);
    expect(r.signals).toHaveLength(0);
  });

  it("ignores redaction placeholders", () => {
    const r = assessReidentificationRisk("Call [PHONE_1] or write to [EMAIL_1] on [DATE_1].");
    expect(r.score).toBe(0);
  });

  it("scores a combination of quasi-identifiers above the default threshold", () => {
    const r = assessReidentificationRisk(
      "I am a 47 years old nurse working at 港区病院, the only night nurse in the ward, and my son is 12."
    );
    expect(r.score).toBeGreaterThan(DEFAULT_POLICY.maxReidRisk);
    const kinds = r.signals.map((s) => s.signal);
    expect(kinds).toEqual(expect.arrayContaining(["exact_age", "occupation", "named_place", "family_detail"]));
  });

  it("detects Japanese quasi-identifiers", () => {
    const r = assessReidentificationRisk("45歳の看護師で、世田谷区に住んでいます。");
    expect(r.signals.map((s) => s.signal)).toEqual(
      expect.arrayContaining(["exact_age", "occupation", "named_place"])
    );
  });

  it("is bounded to 0–100", () => {
    const r = assessReidentificationRisk(
      "47 years old nurse in Shibuya, my son, my wife, the only doctor in Minato, 123456, Taro Yamada said ".repeat(20)
    );
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});
