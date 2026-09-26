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

## Prompts and plan files

`SPEC.md` is the plan file the implementation follows and is kept in the
repo, per SPEC.md §8/§10.
