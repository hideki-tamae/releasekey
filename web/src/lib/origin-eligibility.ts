// Server-side eligibility of a record as the origin of a thread. Used by both
// POST /api/threads and the result page, so the button and the API can never
// disagree. Reads the on-chain status (a chain call), so it is NOT unit-tested
// here; the rule itself is in thread-origin.ts and is tested there.

import type { Hex } from "viem";
import { getRecord } from "./chain";
import { checkThreadOrigin, type OriginChainStatus, type OriginEligibility } from "./thread-origin";

const STATUS_LABELS = ["None", "Created", "Approved", "Revoked"] as const;

async function chainStatus(recordId: Hex): Promise<OriginChainStatus> {
  try {
    const record = await getRecord(recordId);
    return STATUS_LABELS[record.status] ?? "unavailable";
  } catch {
    return "unavailable";
  }
}

/** A refused record has no on-chain record, so the chain is not asked for it. */
export async function originEligibility(
  recordId: Hex,
  stored: { refusedReason?: string }
): Promise<OriginEligibility> {
  return checkThreadOrigin({
    refused: Boolean(stored.refusedReason),
    chainStatus: stored.refusedReason ? "None" : await chainStatus(recordId),
  });
}
