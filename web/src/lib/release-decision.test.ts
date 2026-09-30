import { describe, expect, it } from "vitest";
import { decideRelease, type DecisionInput } from "./release-decision";
import { DEFAULT_POLICY, type ConsentPolicy } from "./consent-policy";
import { redact } from "./disclosure";

const base = (over: Partial<DecisionInput> = {}): DecisionInput => ({
  recipientId: "bob",
  recipientKnown: true,
  sharedText: "Slept badly this week.",
  redaction: redact("Slept badly this week."),
  risk: { score: 10, signals: [] },
  ...over,
});

describe("decideRelease (ordered, fail-closed)", () => {
  it("requires a human for a clean, allowed request — never auto-releases", () => {
    const d = decideRelease(base(), DEFAULT_POLICY);
    expect(d).toEqual({ outcome: "require_human", ttlSeconds: 900, rule: 6 });
  });

  it("rule 1: unknown recipient", () => {
    expect(decideRelease(base({ recipientKnown: false }), DEFAULT_POLICY)).toMatchObject({
      outcome: "deny",
      reason: "unknown_recipient",
    });
    expect(decideRelease(base({ recipientId: undefined }), DEFAULT_POLICY)).toMatchObject({
      reason: "unknown_recipient",
    });
  });

  it("rule 2: recipient not allowed by policy", () => {
    const policy: ConsentPolicy = { ...DEFAULT_POLICY, allowedRecipients: ["carol"] };
    expect(decideRelease(base(), policy)).toMatchObject({ reason: "recipient_not_allowed" });
  });

  it("rule 3: empty content", () => {
    expect(decideRelease(base({ sharedText: "   " }), DEFAULT_POLICY)).toMatchObject({ reason: "empty_content" });
  });

  it("rule 4: redaction required but missing", () => {
    expect(decideRelease(base({ redaction: null }), DEFAULT_POLICY)).toMatchObject({ reason: "redaction_missing" });
    const full: ConsentPolicy = { ...DEFAULT_POLICY, disclosure: "full" };
    expect(decideRelease(base({ redaction: null }), full).outcome).toBe("require_human");
  });

  it("rule 5: re-identification risk above the policy maximum", () => {
    expect(decideRelease(base({ risk: { score: 41, signals: [] } }), DEFAULT_POLICY)).toMatchObject({
      reason: "reidentification_risk_too_high",
    });
    expect(decideRelease(base({ risk: { score: 40, signals: [] } }), DEFAULT_POLICY).outcome).toBe("require_human");
  });

  it("first matching rule wins", () => {
    const d = decideRelease(base({ recipientKnown: false, sharedText: "", risk: { score: 99, signals: [] } }), DEFAULT_POLICY);
    expect(d).toMatchObject({ reason: "unknown_recipient", rule: 1 });
  });

  it("denies on any internal error", () => {
    const broken = { ...DEFAULT_POLICY, allowedRecipients: null } as unknown as ConsentPolicy;
    expect(decideRelease(base(), broken)).toEqual({ outcome: "deny", reason: "router_error", rule: 0 });
  });

  it("caps the TTL at the contract maximum", () => {
    const loose = { ...DEFAULT_POLICY, maxTtlSeconds: 99999 };
    expect(decideRelease(base(), loose)).toMatchObject({ ttlSeconds: 3600 });
  });
});
