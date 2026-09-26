// In-memory store binding an OIDC `state` to the recordId + PKCE verifier +
// nonce it was created for.
//
// DEMO-GRADE LIMITATION (call this out in README): this is a single
// process's memory. It is fine for one Next.js dev/demo instance but does
// not survive a restart and does not work across multiple server
// instances. A production version would use a short-lived server-side
// session store (e.g. Redis) instead.
//
// Kept as a small class (rather than module-level globals) so tests can
// construct an isolated store instead of sharing state across test cases.

import type { Hex } from "viem";

export type PendingRelease = {
  recordId: Hex;
  codeVerifier: string;
  nonce: string;
  createdAt: number;
};

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export class PendingReleaseStore {
  private readonly entries = new Map<string, PendingRelease>();

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  create(state: string, entry: Omit<PendingRelease, "createdAt">): void {
    this.entries.set(state, { ...entry, createdAt: Date.now() });
  }

  /** Single-use: removes the entry so the same `state` can never be
   * consumed twice, even on success. Returns undefined if unknown or
   * expired — callers must treat that as "no approval, ever". */
  consume(state: string, now = Date.now()): PendingRelease | undefined {
    const entry = this.entries.get(state);
    if (!entry) return undefined;
    this.entries.delete(state);
    if (now - entry.createdAt > this.ttlMs) return undefined;
    return entry;
  }
}

// One store per server process, used by the actual API routes.
export const pendingReleaseStore = new PendingReleaseStore();
