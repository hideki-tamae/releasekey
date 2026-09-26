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

- **A client's "sector identifier" (redirect_uri hostname) is permanent from
  the moment the app is first saved with a redirect URI, and cannot be
  changed afterward.** We built and tested locally against `localhost`,
  then tried adding our production `https://releasekey.vercel.app` callback
  to the *same* app once it deployed — the portal rejected it with "Use one
  callback hostname, or provide an HTTPS sector document listing every
  redirect URI." Attempting the sector-document route next, the portal then
  said "The sector cannot change. Use callbacks on the existing sector
  hostname or a sector document hosted there" — i.e. even a sector document
  must be hosted *on the original hostname*, which is impossible for
  `localhost`. We ended up creating a second, separate app (and a second
  `client_id`/`client_secret`) solely for production. This is a reasonable
  security property (it stops an app from silently relocating its identity
  namespace), but it was not mentioned anywhere in the flow until we hit the
  wall — a note in the "Redirect URIs" field's own help text ("the hostname
  of your first redirect URI is permanent for this app") would have let us
  register `localhost` and production as two apps from the start, rather
  than discovering the constraint mid-integration.
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
