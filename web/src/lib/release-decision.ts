// Release decision router (SPEC-v2 §3.4).
//
// Ordered rules, first match wins — the Yohaku (ETHGlobal Tokyo 2026)
// pattern — evaluated BEFORE any on-chain call. There are only two
// outcomes: `deny` (nothing happens, the reason is shown and logged) or
// `require_human` (continue to a fresh World ID verification). There is no
// "auto release": the v1 invariant that the agent can never release alone
// is preserved by construction. Any unexpected error ⇒ deny.

import { CONTRACT_MAX_TTL_SECONDS, type ConsentPolicy } from "./consent-policy";
import type { RedactionResult } from "./disclosure";
import type { ReidAssessment } from "./reid-check";

export type DenyReason =
  | "unknown_recipient"
  | "recipient_not_allowed"
  | "empty_content"
  | "redaction_missing"
  | "reidentification_risk_too_high"
  | "router_error";

export type Decision =
  | { outcome: "deny"; reason: DenyReason; rule: number }
  | { outcome: "require_human"; ttlSeconds: number; rule: number };

export type DecisionInput = {
  recipientId: string | undefined;
  recipientKnown: boolean;
  sharedText: string;
  redaction: RedactionResult | null;
  risk: ReidAssessment;
};

type Rule = (input: DecisionInput, policy: ConsentPolicy) => Decision | null;

const RULES: Rule[] = [
  (i) => (!i.recipientId || !i.recipientKnown ? { outcome: "deny", reason: "unknown_recipient", rule: 1 } : null),
  (i, p) =>
    !p.allowedRecipients.includes(i.recipientId!.toLowerCase())
      ? { outcome: "deny", reason: "recipient_not_allowed", rule: 2 }
      : null,
  (i) => (i.sharedText.trim().length === 0 ? { outcome: "deny", reason: "empty_content", rule: 3 } : null),
  (i, p) =>
    p.disclosure === "redacted" && i.redaction === null
      ? { outcome: "deny", reason: "redaction_missing", rule: 4 }
      : null,
  (i, p) =>
    i.risk.score > p.maxReidRisk
      ? { outcome: "deny", reason: "reidentification_risk_too_high", rule: 5 }
      : null,
  (_i, p) => ({
    outcome: "require_human",
    ttlSeconds: Math.min(p.maxTtlSeconds, CONTRACT_MAX_TTL_SECONDS),
    rule: 6,
  }),
];

export function decideRelease(input: DecisionInput, policy: ConsentPolicy): Decision {
  try {
    for (const rule of RULES) {
      const decision = rule(input, policy);
      if (decision) return decision;
    }
  } catch {
    // fall through
  }
  return { outcome: "deny", reason: "router_error", rule: 0 };
}

export const DENY_REASON_TEXT: Record<DenyReason, string> = {
  unknown_recipient: "The recipient is not in the directory.",
  recipient_not_allowed: "Your policy does not allow sharing with this recipient.",
  empty_content: "There is nothing to share.",
  redaction_missing: "Your policy requires identifiers to be removed first.",
  reidentification_risk_too_high:
    "Even after removing identifiers, this record could still point to you. Remove details and try again.",
  router_error: "Something went wrong, so nothing was shared (fail-closed).",
};
