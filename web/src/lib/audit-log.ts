// Hash-chained audit log (SPEC-v2 §3.5).
//
// Every step of a record's life — including every refusal — is appended as
// an entry whose hash covers the previous entry's hash. Editing, deleting or
// reordering any entry breaks `verifyChain()`. Airlock (ETHGlobal Tokyo 2026)
// used the same idea so that "what the AI was allowed to do" can be checked
// after the fact.
//
// Entries hold NO content and NO personal data: only an event type, the
// random recordId, a reason code and small numeric details (counts, scores,
// TTLs). DEMO-GRADE: one in-memory log per server process, like the other
// stores. Phase 2 persists it and anchors the head hash on-chain.

import { keccak256, toBytes, type Hex } from "viem";

export type AuditEventType =
  | "prepared"
  | "redacted"
  | "policy_denied"
  | "verification_denied"
  | "approved"
  | "access_granted"
  | "access_refused"
  | "revoked";

export type AuditDetails = Record<string, string | number | boolean>;

export type AuditEntry = {
  index: number;
  recordId: string;
  type: AuditEventType;
  reason?: string;
  details?: AuditDetails;
  at: number;
  prevHash: Hex;
  hash: Hex;
};

export const GENESIS_HASH: Hex = `0x${"0".repeat(64)}`;

// Keys that must never appear in details — a guard against someone later
// logging content "just for debugging".
const FORBIDDEN_DETAIL_KEYS = /content|text|plaintext|transcript|name|email|phone|address|salt|key/i;

function hashEntry(e: Omit<AuditEntry, "hash">): Hex {
  // Stable, explicit field order so the hash never depends on object key order.
  const canonical = JSON.stringify([
    e.index,
    e.recordId,
    e.type,
    e.reason ?? null,
    e.details ? Object.keys(e.details).sort().map((k) => [k, e.details![k]]) : null,
    e.at,
    e.prevHash,
  ]);
  return keccak256(toBytes(canonical));
}

export class AuditLog {
  private readonly log: AuditEntry[] = [];

  append(
    recordId: string,
    type: AuditEventType,
    opts: { reason?: string; details?: AuditDetails; at?: number } = {}
  ): AuditEntry {
    if (opts.details) {
      for (const key of Object.keys(opts.details)) {
        if (FORBIDDEN_DETAIL_KEYS.test(key)) {
          throw new Error(`audit details may not contain "${key}"`);
        }
      }
    }
    const prevHash = this.log.length ? this.log[this.log.length - 1].hash : GENESIS_HASH;
    const base = {
      index: this.log.length,
      recordId,
      type,
      ...(opts.reason !== undefined && { reason: opts.reason }),
      ...(opts.details !== undefined && { details: opts.details }),
      at: opts.at ?? Date.now(),
      prevHash,
    };
    const entry: AuditEntry = { ...base, hash: hashEntry(base) };
    this.log.push(entry);
    return entry;
  }

  /** All entries (copies), optionally filtered to one record. */
  entries(recordId?: string): AuditEntry[] {
    const all = this.log.map((e) => ({ ...e, details: e.details && { ...e.details } }));
    return recordId ? all.filter((e) => e.recordId === recordId) : all;
  }

  head(): Hex {
    return this.log.length ? this.log[this.log.length - 1].hash : GENESIS_HASH;
  }
}

/** Verifies a full chain (all records, in order). */
export function verifyChain(entries: AuditEntry[]): { ok: true } | { ok: false; brokenAt: number } {
  let prev: Hex = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const { hash, ...rest } = e;
    if (e.index !== i || e.prevHash !== prev || hashEntry(rest) !== hash) {
      return { ok: false, brokenAt: i };
    }
    prev = hash;
  }
  return { ok: true };
}

// One log per server process, used by the API routes.
export const auditLog = new AuditLog();
