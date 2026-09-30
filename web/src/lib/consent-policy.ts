// Consent policy (SPEC-v2 §3.3).
//
// The data subject's rules for how their records may be released. In the
// full design these live as ENS text records on the subject's own name
// (see ens-policy.ts), so the agent can read them but never rewrite them —
// the same pattern Omamori (ETHGlobal Tokyo 2026) used for family spending
// rules. Everything here is pure and fail-closed: anything missing,
// malformed or out of range falls back to the STRICT default, never to a
// more permissive value.

export type DisclosureMode = "redacted" | "full";

export type ConsentPolicy = {
  maxTtlSeconds: number;
  maxReidRisk: number;
  disclosure: DisclosureMode;
  allowedRecipients: string[];
  /** Where this policy came from, shown in the UI and audit log. */
  source: "default" | "ens";
};

export const POLICY_KEYS = {
  maxTtlSeconds: "com.releasekey.policy.maxTtlSeconds",
  maxReidRisk: "com.releasekey.policy.maxReidRisk",
  disclosure: "com.releasekey.policy.disclosure",
  allowedRecipients: "com.releasekey.policy.allowedRecipients",
} as const;

export const CONTRACT_MAX_TTL_SECONDS = 3600; // ReleaseKey.sol MAX_TTL_SECONDS

export const DEFAULT_POLICY: ConsentPolicy = {
  maxTtlSeconds: 900,
  maxReidRisk: 40,
  disclosure: "redacted",
  allowedRecipients: ["bob", "carol"],
  source: "default",
};

function parseIntInRange(value: string | undefined, min: number, max: number): number | undefined {
  if (value === undefined || !/^\d+$/.test(value.trim())) return undefined;
  const n = Number(value.trim());
  return n >= min && n <= max ? n : undefined;
}

/**
 * Builds a policy from raw text-record values. Each field is validated on
 * its own; an invalid field falls back to the strict default for that field
 * only. `source` is "ens" only if at least one field was valid.
 */
export function parsePolicy(records: Partial<Record<keyof typeof POLICY_KEYS, string | undefined>>): ConsentPolicy {
  const maxTtlSeconds = parseIntInRange(records.maxTtlSeconds, 60, CONTRACT_MAX_TTL_SECONDS);
  const maxReidRisk = parseIntInRange(records.maxReidRisk, 0, 100);

  const rawDisclosure = records.disclosure?.trim().toLowerCase();
  const disclosure: DisclosureMode | undefined =
    rawDisclosure === "redacted" || rawDisclosure === "full" ? rawDisclosure : undefined;

  const recipients = records.allowedRecipients
    ?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-z0-9-]{1,32}$/.test(s));
  const allowedRecipients = recipients && recipients.length > 0 ? recipients : undefined;

  const anyValid = [maxTtlSeconds, maxReidRisk, disclosure, allowedRecipients].some((v) => v !== undefined);

  return {
    maxTtlSeconds: maxTtlSeconds ?? DEFAULT_POLICY.maxTtlSeconds,
    maxReidRisk: maxReidRisk ?? DEFAULT_POLICY.maxReidRisk,
    disclosure: disclosure ?? DEFAULT_POLICY.disclosure,
    allowedRecipients: allowedRecipients ?? DEFAULT_POLICY.allowedRecipients,
    source: anyValid ? "ens" : "default",
  };
}
