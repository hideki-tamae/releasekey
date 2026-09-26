import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock jose's jwtVerify so we can simulate a tampered/invalid signature
// without hitting the real sandbox JWKS endpoint over the network.
const jwtVerifyMock = vi.fn();
vi.mock("jose", () => ({
  createRemoteJWKSet: () => ({}),
  jwtVerify: (...args: unknown[]) => jwtVerifyMock(...args),
}));

process.env.WORLD_CLIENT_ID = "test-client-id";
process.env.WORLD_CLIENT_SECRET = "test-client-secret";
process.env.WORLD_REDIRECT_URI = "https://localhost:3010/api/world/callback";

const { verifyWorldIdToken, WorldVerificationError } = await import("./world-oidc");

const nowSeconds = () => Math.floor(Date.now() / 1000);

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://sandbox.auth.world.org",
    sub: "user-sub",
    aud: "test-client-id",
    jti: "jti-1",
    nonce: "expected-nonce",
    auth_time: nowSeconds(),
    acr: "https://world.org/oidc/acr/orb-v3",
    exp: nowSeconds() + 60,
    iat: nowSeconds(),
    ...overrides,
  };
}

describe("verifyWorldIdToken — SPEC §6 'unvalidated or tampered response → no approval call'", () => {
  beforeEach(() => {
    jwtVerifyMock.mockReset();
  });

  it("rejects when the signature/claims check itself fails (tampered token)", async () => {
    jwtVerifyMock.mockRejectedValue(new Error("signature verification failed"));
    await expect(verifyWorldIdToken("bad.token.here", "expected-nonce")).rejects.toThrow(
      WorldVerificationError
    );
  });

  it("rejects when the nonce does not match this request (replayed from elsewhere)", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: validPayload({ nonce: "someone-elses-nonce" }) });
    await expect(verifyWorldIdToken("token", "expected-nonce")).rejects.toThrow(
      WorldVerificationError
    );
  });

  it("rejects a non-orb assurance level", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: validPayload({ acr: "some-lower-level" }) });
    await expect(verifyWorldIdToken("token", "expected-nonce")).rejects.toThrow(
      WorldVerificationError
    );
  });

  it("rejects a stale authentication (expired/cancelled-and-retried session)", async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: validPayload({ auth_time: nowSeconds() - 999 }),
    });
    await expect(
      verifyWorldIdToken("token", "expected-nonce", /* maxAuthAgeSeconds */ 120)
    ).rejects.toThrow(WorldVerificationError);
  });

  it("accepts a valid, fresh, correctly-bound token", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: validPayload() });
    const claims = await verifyWorldIdToken("token", "expected-nonce");
    expect(claims.sub).toBe("user-sub");
  });
});
