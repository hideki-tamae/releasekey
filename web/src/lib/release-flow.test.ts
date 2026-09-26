import { describe, it, expect } from "vitest";
import type { Hex } from "viem";
import { PendingReleaseStore } from "./pending-release-store";
import { resolvePendingRelease, buildVerificationRef, ReleaseFlowError } from "./release-flow";
import type { WorldIdTokenClaims } from "./world-oidc";

const RECORD_A: Hex = `0x${"a".repeat(64)}`;
const RECORD_B: Hex = `0x${"b".repeat(64)}`;

function claims(overrides: Partial<WorldIdTokenClaims> = {}): WorldIdTokenClaims {
  return {
    iss: "https://sandbox.auth.world.org",
    sub: "user-sub-123",
    aud: "test-client",
    jti: "token-jti-abc",
    nonce: "nonce-xyz",
    auth_time: Math.floor(Date.now() / 1000),
    acr: "https://world.org/oidc/acr/orb-v3",
    exp: Math.floor(Date.now() / 1000) + 60,
    iat: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

describe("resolvePendingRelease — SPEC §6 required backend tests", () => {
  it("rejects a missing state (no on-chain call can follow)", () => {
    const store = new PendingReleaseStore();
    expect(() => resolvePendingRelease(store, null)).toThrow(ReleaseFlowError);
  });

  it("rejects an unknown state — e.g. a tampered or fabricated callback", () => {
    const store = new PendingReleaseStore();
    expect(() => resolvePendingRelease(store, "never-issued")).toThrow(ReleaseFlowError);
  });

  it("rejects an expired pending release", () => {
    const store = new PendingReleaseStore(1); // 1ms TTL
    store.create("state-1", { recordId: RECORD_A, codeVerifier: "v", nonce: "n" });
    // let it expire
    const expired = new Promise((r) => setTimeout(r, 5));
    return expired.then(() => {
      expect(() => resolvePendingRelease(store, "state-1")).toThrow(ReleaseFlowError);
    });
  });

  it("a state can only ever be consumed once (no replay of a cancelled/used flow)", () => {
    const store = new PendingReleaseStore();
    store.create("state-1", { recordId: RECORD_A, codeVerifier: "v", nonce: "n" });

    const first = resolvePendingRelease(store, "state-1");
    expect(first.recordId).toBe(RECORD_A);

    expect(() => resolvePendingRelease(store, "state-1")).toThrow(ReleaseFlowError);
  });

  it("resolves the exact recordId the state was created for, never another one", () => {
    const store = new PendingReleaseStore();
    store.create("state-for-a", { recordId: RECORD_A, codeVerifier: "va", nonce: "na" });
    store.create("state-for-b", { recordId: RECORD_B, codeVerifier: "vb", nonce: "nb" });

    const pendingA = resolvePendingRelease(store, "state-for-a");
    expect(pendingA.recordId).toBe(RECORD_A);
    expect(pendingA.recordId).not.toBe(RECORD_B);
  });
});

describe("buildVerificationRef — verification for record A cannot approve record B", () => {
  it("produces a different ref for the same World ID claims under a different recordId", () => {
    const sameClaims = claims();
    const refA = buildVerificationRef(RECORD_A, sameClaims);
    const refB = buildVerificationRef(RECORD_B, sameClaims);
    expect(refA).not.toBe(refB);
  });

  it("is deterministic for the same (recordId, claims) pair", () => {
    const c = claims();
    expect(buildVerificationRef(RECORD_A, c)).toBe(buildVerificationRef(RECORD_A, c));
  });

  it("changes if the verified subject differs, even for the same recordId", () => {
    const refUser1 = buildVerificationRef(RECORD_A, claims({ sub: "user-1" }));
    const refUser2 = buildVerificationRef(RECORD_A, claims({ sub: "user-2" }));
    expect(refUser1).not.toBe(refUser2);
  });
});
