# AI-USE

Which AI tools touched this repo, for which files, and which decisions were
made or reviewed by a human (Hideki Tamae, the sole team member).

## Tools used

- **Claude (Anthropic)** — the large majority of code, review, and debugging.
  Used in two contexts:
  - A background/cloud Claude session drafted the World ID for Agents OIDC
    client, release-flow logic, API routes, UI, and the required backend
    tests, delivered as 4 git patches.
  - A local Claude Code session (this one) applied those patches, wired real
    deployment secrets, ran the app, and did all live debugging described
    below.
- **Gemini** — an earlier session used Gemini to scaffold an initial World ID
  integration. It implemented `@worldcoin/idkit` ("Incognito Actions"), which
  turned out to be the wrong World product for this spec (SPEC.md §6 calls
  for **World ID for Agents**, an OIDC flow — a different integration
  surface from Incognito Actions). That code (`web/app/*`, the
  `@worldcoin/idkit` dependency) was fully removed in commit `39a3030` before
  the correct OIDC client was built. Disclosed here per SPEC.md §8.

## What was human-reviewed vs. AI-authored

| Area | Authored by | Human review |
|---|---|---|
| `src/ReleaseKey.sol`, Foundry tests, deploy script | Claude | Hideki reviewed the role-separation invariant and approved the Sepolia deployment (funded the deployer wallet, confirmed the deploy tx) |
| `web/src/lib/world-oidc.ts`, `release-flow.ts`, `chain.ts`, API routes, `/release` UI, backend tests | Claude (cloud session, 4 patches) | Hideki reviewed the patch summary and asked the local Claude session to apply, verify, and push them |
| Env var wiring (`web/.env.local`) | Claude, using values from the repo's own `.env` (deploy-time keys) and Hideki's Sepolia faucet funding | Hideki funded both `AGENT_ROLE`/`APPROVER_ROLE` wallets with Sepolia ETH after the first funds-insufficient run, and confirmed the push of each fix |
| Three bugs found and fixed during live verification (see below) | Claude found, diagnosed, and fixed all three; Hideki ran the actual browser flow that surfaced them and confirmed each fix worked | Hideki approved each `git push` after being shown the diff and the reasoning |
| README.md, AI-USE.md, WORLD-FEEDBACK.md | Claude | Hideki requested these be added per SPEC.md §8/§9 |

## Bugs found and fixed by Claude during live end-to-end verification

These were not caught by the unit tests — only surfaced by actually running
the app against the real World ID sandbox and Sepolia testnet:

1. **Next.js 16.3.6 silently serves plain HTTP** if `--experimental-https-key`
   / `--experimental-https-cert` are passed without the base
   `--experimental-https` flag — which breaks World's `redirect_uri` (must be
   `https://`). Found by diffing server output across three flag
   combinations; fixed in `web/package.json`.
2. **World's sandbox token endpoint (`/api/v1/token`) requires
   `client_secret_basic`** (an `Authorization: Basic` header), not
   `client_secret_post` (client_id/secret in the request body) — the initial
   implementation used the latter and every token exchange failed with
   `invalid_client`. Found by calling the token endpoint directly with a
   throwaway authorization code and comparing the OAuth error returned
   (`invalid_client` → `invalid_grant` once the auth method was corrected —
   `invalid_grant` on a fake code is the *expected* failure, confirming
   client auth itself now succeeds). Fixed in `web/src/lib/world-oidc.ts`.
   See `WORLD-FEEDBACK.md`.
3. **Race condition**: `createCommitment` returned as soon as the transaction
   was broadcast, not once it was mined. World's `prompt=login`+`max_age=0`
   flow can complete in a few seconds — faster than Sepolia's ~12s block
   time — so a fast login could reach `approveRelease` while the record was
   still `Status.None` on-chain, reverting with `InvalidStatus()`. Found by
   decoding the revert's custom-error selector against the contract ABI and
   confirming the record's on-chain status with a direct `eth_call`. Fixed by
   awaiting `publicClient.waitForTransactionReceipt` in
   `web/src/lib/chain.ts`.

## Vercel deployment

Claude linked and deployed the project to Vercel via the CLI (`vercel link`,
`vercel deploy --prod`), fixed a Vercel-specific build failure (same
peer-dependency conflict as local `npm install`, resolved with a
`web/vercel.json` `installCommand` override), and set the production
environment variables. Two decisions were escalated to Hideki rather than
made unilaterally by Claude:

- Writing/removing values in Vercel's environment-variable store was blocked
  by this session's own auto-mode permission classifier (`Secret-Store
  Writes`); Hideki explicitly approved that specific command before Claude
  ran it.
- World's Platform Portal permanently ties a client's redirect_uri to the
  hostname it was first registered with (see `WORLD-FEEDBACK.md`), which
  meant the existing `localhost` World ID client could not also serve
  production. Hideki created a second World ID app in the portal himself
  (a step requiring portal login, which Claude cannot do) and passed the new
  `client_id`/`client_secret` to Claude, which wired them into Vercel's
  production environment and redeployed.

## ENS public-key directory (worked out with Thomas, the ENS-track teammate)

The design (recipient publishes an encryption public key as an ENS text
record; the agent looks it up and encrypts to it) came out of a live
back-and-forth with Thomas, our teammate handling the ENS/consent piece —
Claude relayed his questions and concerns (data privacy for the recipient
matching/triage step, "do we even need a contract," zero-knowledge
proofs) between the two humans, translating and clarifying, but every
design decision was made by Hideki and Thomas, not by Claude alone.

Claude then implemented and verified it end to end: registered
`releasekey.eth` (Hideki performed the actual registration transaction
himself through the official ENS app, since Claude cannot hold or approve
a wallet transaction through a UI), diagnosed why writing a text record
silently reverted (Sepolia's ENSv2 resolver takes a DNS-encoded name, not
a `namehash` — see `ENS-FEEDBACK.md`), wrote the actual public key Thomas
shared for a demo "Bob" keypair, and implemented the hybrid-encryption
library (`web/src/lib/ens-crypto.ts`) with unit tests. Hideki reviewed and
approved every on-chain write before it happened, same as throughout this
project.

One judgment call flagged rather than made unilaterally: when Claude's
first attempt at diagnosing the ENSv2 write failure hit a dead end
(sandbox exploration budget nearly spent), Claude recommended cutting the
ENS integration entirely rather than continuing to guess. Hideki pushed
back, asked for an honest time estimate instead of a default-to-caution
answer, and that reset led directly to finding the real fix (reading the
resolver's verified proxy implementation on Etherscan). Recorded here
because it's a real instance of a human correcting an AI's risk-aversion,
not just approving what Claude proposed.

## Prompts and plan files

`SPEC.md` is the plan file the implementation follows and is kept in the
repo, per SPEC.md §8/§10.

## v2 (post-hackathon, 2026-09-30)

v2 was designed and implemented with Claude (Anthropic) after the event,
on the `v2` branch, starting from the frozen v1 tag `v1-ethglobal-tokyo-2026`.

- **Analysis:** Claude re-verified the ETHGlobal Tokyo 2026 results against
  the official Showcase and the closing-ceremony transcript, then compared
  HAIS Agent with the finalists and prize winners (Airlock, Yohaku,
  Omamori). Hideki chose the direction ("make HAIS Agent the recommended
  version") and asked for a before/after that stays visible on GitHub.
- **Spec:** `SPEC-v2.md` and `docs/v2/*` were drafted by Claude from that
  analysis; scope (Phase 1 implemented, Phase 2/3 designed only) and the
  rule "no auto-release, ever" were kept from v1.
- **Code:** Claude wrote the Phase 1 modules and their tests
  (`disclosure`, `reid-check`, `consent-policy`, `ens-policy`,
  `release-decision`, `audit-log`), wired them into the API routes and UI,
  and verified: 47 unit tests passing, lint clean, `next build` passing,
  and the policy-denial path exercised live against a running build
  (screenshots in `docs/v2/img`). The approval path still needs a real
  World ID + Sepolia run by a human before it is claimed as live.
- The deployed contract is unchanged.
