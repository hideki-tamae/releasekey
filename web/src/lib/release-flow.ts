// Pure, testable glue between "a World ID callback arrived" and "call
// approveRelease on-chain". Kept free of Next.js request/response types
// and of the actual chain/OIDC network calls so the required backend
// tests in SPEC.md §6 can exercise it directly:
//   - Unvalidated or tampered response → no approval call.
//   - Expired/cancelled → no approval call.
//   - Verification for recordId A cannot approve recordId B.

import { encodeAbiParameters, keccak256, type Hex } from "viem";
import type { WorldIdTokenClaims } from "./world-oidc";
import type { PendingRelease, PendingReleaseStore } from "./pending-release-store";

export class ReleaseFlowError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
  }
}

/**
 * Resolves and consumes the pending release for this `state`. Throws if
 * the state is unknown, already used, or expired — every one of those
 * must short-circuit before any approval call is made.
 */
export function resolvePendingRelease(
  store: PendingReleaseStore,
  state: string | null
): PendingRelease {
  if (!state) throw new ReleaseFlowError("missing_state");
  const pending = store.consume(state);
  if (!pending) throw new ReleaseFlowError("unknown_or_expired_state");
  return pending;
}

/**
 * Binds a verified World ID token to the exact recordId this OIDC request
 * was created for. recordId comes only from the server-side pending entry
 * — never from anything the client sends on the callback — so a
 * verification obtained while releasing record A can never be replayed to
 * approve record B: it isn't just that the hash would differ, the callback
 * has no path to even attempt approving a different recordId with it.
 */
export function buildVerificationRef(recordId: Hex, claims: WorldIdTokenClaims): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "string" }, { type: "string" }],
      [recordId, claims.sub, claims.jti]
    )
  );
}

export const RELEASE_TTL_SECONDS = 15 * 60; // <= MAX_TTL_SECONDS (1h) on-chain
