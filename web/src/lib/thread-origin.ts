// Which records may start a follow-up thread (SPEC-v2 §3, Phase 1.5 part 2).
//
// Only a record whose decision is final can be the origin: approved, revoked,
// or refused. A record still awaiting approval ("Created") cannot. That
// approval belongs to the first share, and a thread must never run ahead of it.
// Pure function, so the rule is unit-tested without the chain.

export type OriginChainStatus = "None" | "Created" | "Approved" | "Revoked" | "unavailable";

export type OriginEligibility = { ok: true } | { ok: false; reason: "record_awaiting_approval" | "record_not_decided" };

export function checkThreadOrigin(input: { refused: boolean; chainStatus: OriginChainStatus }): OriginEligibility {
  if (input.refused) return { ok: true };
  if (input.chainStatus === "Approved" || input.chainStatus === "Revoked") return { ok: true };
  if (input.chainStatus === "Created") return { ok: false, reason: "record_awaiting_approval" };
  return { ok: false, reason: "record_not_decided" };
}
