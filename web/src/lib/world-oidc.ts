// World ID for Agents — OIDC client (sandbox).
// Discovery: GET https://sandbox.auth.world.org/.well-known/openid-configuration
// Standard OpenID Connect Core 1.0 authorization-code flow + PKCE (RFC 7636) +
// RFC 9470 authentication step-up (we force a *fresh* human check on every
// release via prompt=login, never a cached session).
//
// IMPORTANT: this file only talks to World ID. It never touches the chain.
// Approving a release on-chain happens in release-flow.ts, only after the
// id_token here has been fully verified server-side.

import { createRemoteJWKSet, jwtVerify } from "jose";
import { createHash, randomBytes } from "crypto";

const ISSUER = "https://sandbox.auth.world.org";
const AUTHORIZATION_ENDPOINT = `${ISSUER}/api/v1/authorize`;
const TOKEN_ENDPOINT = `${ISSUER}/api/v1/token`;
const JWKS_URI = `${ISSUER}/.well-known/jwks.json`;

// Orb-verified human, per the sandbox's acr_values_supported.
const REQUIRED_ACR = "https://world.org/oidc/acr/orb-v3";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const jwks = createRemoteJWKSet(new URL(JWKS_URI));

function base64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/** PKCE verifier/challenge pair (S256), plus a fresh state and nonce. */
export function createAuthRequestSecrets() {
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  const state = base64url(randomBytes(16));
  const nonce = base64url(randomBytes(16));
  return { codeVerifier, codeChallenge, state, nonce };
}

/**
 * Builds the redirect URL to World ID for Agents, binding this specific
 * authorization request to `state`/`nonce` (server-generated, stored
 * server-side against the recordId — see release-flow.ts). There is no
 * app-level "action"/"signal" parameter in this OIDC profile; the binding
 * to a specific record happens entirely on our side via the opaque state.
 */
export function buildAuthorizeUrl(params: {
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const url = new URL(AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", requiredEnv("WORLD_CLIENT_ID"));
  url.searchParams.set("redirect_uri", requiredEnv("WORLD_REDIRECT_URI"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid");
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  // Force a brand-new human check every time — never reuse a cached session.
  url.searchParams.set("prompt", "login");
  url.searchParams.set("max_age", "0");
  url.searchParams.set("acr_values", REQUIRED_ACR);
  return url.toString();
}

export type WorldIdTokenClaims = {
  iss: string;
  sub: string;
  aud: string | string[];
  jti: string;
  nonce: string;
  auth_time: number;
  acr: string;
  amr?: string[];
  exp: number;
  iat: number;
};

/** Thrown for any failure to obtain/validate a verification. Callers must
 * treat every one of these as "no approval" — never a partial success. */
export class WorldVerificationError extends Error {}

/** Exchanges an authorization code for tokens (server-side only — never
 * expose WORLD_CLIENT_SECRET to the client). */
export async function exchangeCodeForIdToken(
  code: string,
  codeVerifier: string
): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: requiredEnv("WORLD_REDIRECT_URI"),
      client_id: requiredEnv("WORLD_CLIENT_ID"),
      client_secret: requiredEnv("WORLD_CLIENT_SECRET"),
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    throw new WorldVerificationError(`Token exchange failed (${res.status})`);
  }

  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) {
    throw new WorldVerificationError("Token response missing id_token");
  }
  return body.id_token;
}

/**
 * Verifies the id_token's signature, issuer, audience, and expiry via the
 * remote JWKS, then enforces the properties this app depends on:
 * - `nonce` matches the one we generated for this authorization request
 *   (binds the token to *our* request, not a replayed one).
 * - `acr` shows an orb-verified human (not a lower assurance level).
 * - `auth_time` is very recent (rejects a stale/cached session — this is
 *   the "fresh, backend-validated human verification at the moment of
 *   release" the whole project is built around).
 * Never trust a client-supplied claims object — this function always
 * re-verifies against the JWKS itself.
 */
export async function verifyWorldIdToken(
  idToken: string,
  expectedNonce: string,
  maxAuthAgeSeconds = 120
): Promise<WorldIdTokenClaims> {
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, jwks, {
      issuer: ISSUER,
      audience: requiredEnv("WORLD_CLIENT_ID"),
    }));
  } catch (err) {
    throw new WorldVerificationError(
      `id_token signature/claims verification failed: ${(err as Error).message}`
    );
  }

  const claims = payload as unknown as WorldIdTokenClaims;

  if (claims.nonce !== expectedNonce) {
    throw new WorldVerificationError("id_token nonce does not match this request");
  }
  if (claims.acr !== REQUIRED_ACR) {
    throw new WorldVerificationError(`id_token acr not orb-verified: ${claims.acr}`);
  }
  const authAge = Math.floor(Date.now() / 1000) - claims.auth_time;
  if (authAge > maxAuthAgeSeconds) {
    throw new WorldVerificationError(`Authentication is stale (${authAge}s old)`);
  }

  return claims;
}
