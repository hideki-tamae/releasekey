# Feedback for World (World ID for Agents)

Feedback from integrating World ID for Agents (OIDC, sandbox) into
ReleaseKey during ETHGlobal Tokyo 2026, for the World team.

## What we built

A standard OpenID Connect Core 1.0 authorization-code flow + PKCE against
`sandbox.auth.world.org`, used as a release gate: an AI agent can prepare a
record, but only a fresh World ID verification (forced via `prompt=login`,
`max_age=0`, `acr_values=…/orb-v3`) can authorize releasing it. See
`web/src/lib/world-oidc.ts`.

## Time to first success

The authorize redirect (building the URL, PKCE challenge, state/nonce) worked
on the first attempt — standard OIDC, no surprises there. The **token
exchange** did not work until the third attempt at diagnosing it, roughly
30–40 minutes of debugging from first `invalid_client` to a working
exchange.

## The single highest-impact improvement

**Document, in the OIDC client integration guide, which client
authentication method the token endpoint expects.** We initially sent
`client_id`/`client_secret` as `application/x-www-form-urlencoded` body
parameters (`client_secret_post`) — a valid, common OAuth 2.0 client
authentication method, and the one most third-party OIDC client examples
default to. The sandbox token endpoint rejected this with
`{"error":"invalid_client"}` and no further detail. Switching to an
`Authorization: Basic base64(client_id:client_secret)` header
(`client_secret_basic`) fixed it immediately.

We only found this by trial and error: calling
`https://sandbox.auth.world.org/api/v1/token` directly with `curl`, once
with credentials in the body (`invalid_client`) and once with an
`Authorization: Basic` header (`invalid_grant` — the *expected* result for a
throwaway authorization code, confirming client auth had succeeded). A single
line in the docs — "this endpoint requires `client_secret_basic`; body
credentials are rejected" — or a matching detail in the `invalid_client`
error message itself, would have saved most of that time.

## Other friction / missing capability or docs

- The `invalid_client` and `invalid_grant` error bodies returned by the
  sandbox token endpoint contain only `{"error": "..."}`, with no
  `error_description`. Adding one (RFC 6749 §5.2 makes this optional but
  encourages it) would make integrator-side debugging much faster without
  needing to guess-and-check like we did.
- We did not find an obvious way, from the hosted sandbox verification page
  itself, to deliberately simulate a user **denying/cancelling** a
  verification (as opposed to letting the OIDC flow error or time out). We
  tested our own failure-path handling (denied / tampered `state` / missing
  `code`) by calling our own callback route directly instead, which
  correctly reproduces our code's behavior but does not exercise a real
  "user clicked deny" round trip. A "simulate deny" control in the sandbox UI
  (mirroring what a fake-identity provider can safely offer) would let
  integrators test this path end-to-end.
- The sandbox's fake-identity model is well suited to a hackathon demo and
  was otherwise straightforward to use once the auth-method issue above was
  resolved.
