// In-memory store holding each prepared record's encrypted content,
// keyed by recordId.
//
// DEMO-GRADE LIMITATION (same as pending-release-store.ts): single
// process's memory, does not survive a restart or scale across server
// instances. A production version would use real off-chain storage
// (e.g. the recipient's own service, IPFS+encryption, a database) —
// this stands in for "content lives off-chain," per SPEC.md's data
// boundary table, which was never otherwise implemented in this demo.
import type { Hex } from "viem";
import type { EncryptedPayload } from "./ens-crypto";

export type StoredRecord = {
  recipientEns: string;
  doctorId: string;
  /** Absent for a refused record: nothing was encrypted or committed. */
  encryptedContent?: EncryptedPayload;
  /** Set for a record refused before the chain. It keeps no content, only the reason code. */
  refusedReason?: string;
  /** Approval TTL decided by the consent policy (SPEC-v2 §3.4). */
  ttlSeconds?: number;
  /** Set only for a follow-up record that belongs to a thread (Phase 1.5). */
  threadId?: string;
  createdAt: number;
};

const records = new Map<Hex, StoredRecord>();

export function storeRecord(recordId: Hex, entry: Omit<StoredRecord, "createdAt">): void {
  records.set(recordId, { ...entry, createdAt: Date.now() });
}

/** Keeps a refusal so it can be the origin of a follow-up. No content is stored. */
export function storeRefusal(recordId: Hex, entry: { recipientEns: string; doctorId: string; reason: string }): void {
  records.set(recordId, { ...entry, refusedReason: entry.reason, createdAt: Date.now() });
}

export function getStoredRecord(recordId: Hex): StoredRecord | undefined {
  return records.get(recordId);
}
