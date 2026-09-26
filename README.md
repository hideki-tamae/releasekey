# ReleaseKey

An AI agent can **prepare** a sensitive record for sharing, but can **never release it alone** — every release requires a fresh, backend-validated human verification at the moment of release, and the chain stores only a minimal commitment, never content or personal data.

Full design rationale, scope, and requirements: see [`SPEC.md`](./SPEC.md).

## Architecture

```
User (passkey, JAW.id)                Agent (AGENT_ROLE key)
        │                                      │
        │  1. creates a record                 │
        │                                       ▼
        │                          createCommitment(recordId, commitment, recipientCommitment)
        │                                       │
        │  2. clicks "Release"                  ▼
        ▼                              ReleaseKey.sol on Sepolia
World ID for Agents verification              (status: Created)
        │
        ▼
Backend validates server-side
        │
        ▼
Approver (APPROVER_ROLE key) ──▶ approveRelease(recordId, verificationRef, ttl)
        │
        ▼
   status: Approved → short-lived release envelope issued
```

The AGENT_ROLE wallet can only create commitments. Only the APPROVER_ROLE
wallet — acting after the backend validates a fresh World ID verification —
can approve a release or revoke it. **The agent can never approve its own
release.** This is verified by 16 passing Foundry tests, 13 passing backend
tests for the World ID gate (`web/src/lib/*.test.ts`), and live on Sepolia
(see Deployment and World ID sections below).

## Data boundary

| Data | Where | On-chain? |
|---|---|---|
| Record content, files, names, recipient details, exact timestamps, consent text | Client / encrypted off-chain storage | **Never** |
| Salt, keys, plaintext hashes | Client / server secret storage | **Never** |
| Random record ID (`bytes32`) | Contract | Yes |
| Salted commitment `keccak256(abi.encode(contentHash, salt))` | Contract | Yes |
| Recipient commitment `keccak256(abi.encode(recipientNode, recipientSalt))` | Contract | Yes (hides who the recipient is) |
| Coarse events: Created / Approved / Revoked | Contract events | Yes |

A salted hash is **publicly visible but only verifiable by someone holding
the salt** — never "only revealable to the key holder."

Known trade-offs, stated honestly:
- On-chain events cannot be deleted or corrected. Off-chain deletion does not erase them.
- Wallet addresses and event timing are metadata and can be linkable.
- Losing keys/salts means the owner cannot prove what a commitment refers to.

## Deployment (Sepolia)

| Item | Value |
|---|---|
| `ReleaseKey.sol` contract | [`0x56EdE4FbDED72B0e05F3Cc92bD41F98a74549686`](https://sepolia.etherscan.io/address/0x56EdE4FbDED72B0e05F3Cc92bD41F98a74549686) |
| Deployment transaction | [View on Etherscan](https://sepolia.etherscan.io/tx/0x0fce010c7b0955ec1bcf8d2dbc1b3b9acb67f1dced8ea2f20ec940f7b3818310) |
| Etherscan verification | **Verified** — [view source](https://sepolia.etherscan.io/address/0x56ede4fbded72b0e05f3cc92bd41f98a74549686#code) |

On-chain proof of the core invariant (checked live via `cast call` after deployment):

| Check | Result |
|---|---|
| Agent wallet has `AGENT_ROLE` | `true` |
| Approver wallet has `APPROVER_ROLE` | `true` |
| **Agent wallet has `APPROVER_ROLE`** | **`false`** — the agent cannot approve its own release, proven on Sepolia, not just in tests |

## World ID for Agents — release gate

Standard OpenID Connect Core 1.0 authorization-code flow + PKCE (RFC 7636)
against World's sandbox (`sandbox.auth.world.org`), forcing a fresh,
never-cached human check on every release (`prompt=login`, `max_age=0`,
`acr_values=…/orb-v3`). Implementation: `web/src/lib/world-oidc.ts` (OIDC
client), `web/src/app/api/world/{authorize,callback}/route.ts` (routes),
`web/src/lib/release-flow.ts` (binds a verification to one `recordId`,
rejects replay/tampering/mismatch).

Verified live end-to-end on Sepolia — not just unit-tested:

| Step | Result |
|---|---|
| `POST /api/records` → `createCommitment` mined | e.g. [`0x5586b5ac…`](https://sepolia.etherscan.io/tx/0x5586b5ac31b03baa2264262f52d103c50b2a1f7acc279272d8bffbf01e64a242) |
| World ID sandbox authorization + token exchange | succeeds (client authenticates via HTTP Basic per the sandbox's requirement — see `WORLD-FEEDBACK.md`) |
| `approveRelease` called on-chain, only after a verified id_token | e.g. record [`0xe77db848…`](https://sepolia.etherscan.io/address/0x56ede4fbded72b0e05f3cc92bd41f98a74549686) → `status: Approved` |
| Failure paths never touch the chain | verified: World ID denial (`error=…`), tampered/unknown `state`, missing `code` — each redirects to `/release/result?status=denied&reason=…` with zero contract calls |

13 passing tests (`cd web && npm test`) cover replay prevention
(`VerificationAlreadyUsed`), token-verification failure, non-orb `acr`,
stale `auth_time`, and TTL bounds at the function level.

## ENS — recipient public-key directory

A recipient publishes their content-encryption public key as an ENS text
record (`com.releasekey.encryptionPubKey`) on their own name. The agent's
prepare step looks it up and encrypts the record to it — hybrid encryption
(ephemeral secp256k1 key + ECDH + HKDF + AES-256-GCM). Only the recipient's
private key can ever decrypt it; not us, not the sender, not anyone reading
the (public) ENS record or the (public) chain. Implementation:
`web/src/lib/ens-crypto.ts` (pure crypto, unit-tested), `web/src/lib/ens-encryption.ts`
(the ENS lookup).

Verified live on Sepolia, not just unit-tested:

| Step | Result |
|---|---|
| Registered [`releasekey.eth`](https://sepolia.app.ens.domains/releasekey.eth) via the official ENS app | expires 2026-09-26 (1 year) |
| Wrote a real public key to its `com.releasekey.encryptionPubKey` text record | [`0xac65d84e…`](https://sepolia.etherscan.io/tx/0xac65d84e46dbeb326e48ea190abf8052c967d5640c7b357b40424215d6128850) |
| `POST /api/records` with `{"recipientEns": "releasekey.eth"}` | looks the key up from ENS and returns real ciphertext (`encryptedContent`) |
| Decrypted with the actual recipient's private key | matches the original plaintext |
| Decryption attempted with a different private key | fails (AES-GCM auth tag rejection) |

ENSv2's resolver on Sepolia (`PermissionedResolver`) takes a DNS-wire-encoded
name (`bytes`, via viem's `packetToBytes`) rather than the classic `namehash`
— see `WORLD-FEEDBACK.md` for the debugging story. 3 passing unit tests
cover the crypto in isolation (recipient decrypts, others can't, ciphertext
is fresh per call).

## Setup

```bash
# Contracts
forge install
cp .env.example .env   # fill in DEPLOYER_PRIVATE_KEY, AGENT_WALLET_ADDRESS, APPROVER_WALLET_ADDRESS
forge test -vv
forge script script/DeployReleaseKey.s.sol:DeployReleaseKey --rpc-url sepolia --broadcast

# Frontend
cd web
npm install --legacy-peer-deps
cp .env.example .env.local   # fill in AGENT/APPROVER_PRIVATE_KEY, RELEASEKEY_CONTRACT_ADDRESS,
                              # SEPOLIA_RPC_URL, WORLD_CLIENT_ID/SECRET, NEXT_PUBLIC_JAW_API_KEY
npm test                     # 13 backend tests for the World ID gate
npm run dev                  # HTTPS on :3010 (self-signed cert — browser will warn, accept it);
                              # World's redirect_uri requires https, hence --experimental-https
```

World's Platform Portal permanently locks a client's `redirect_uri` to the
hostname it was first registered with ("sector identifier") — see
`WORLD-FEEDBACK.md`. Practically, this means a `localhost` client and a
production client **cannot share one `WORLD_CLIENT_ID`**: each deployment
target needs its own client registered under a single hostname. This repo
uses two separate World ID clients — one for local dev, one for production —
each with its own `WORLD_CLIENT_ID`/`WORLD_CLIENT_SECRET`.

## Live demo

**https://releasekey.vercel.app** — deployed on Vercel, connected to the same
Sepolia contract as above. `/release` walks through prepare → World ID
verify → approve, and was confirmed working live in production (not just
locally) on 2026-09-26.

Production uses its own World ID for Agents client, separate from the one
used for local development — see the note in Setup below.

## Known limitations

- World ID for Agents runs against the **sandbox** environment (`sandbox.auth.world.org`), which uses fake identities by design — this is the intended integration point for a hackathon demo, not a claim of production Orb verification.
- Local dev HTTPS uses a self-signed certificate; browsers show a one-time warning.
- ENS integration is a single name (`releasekey.eth`) holding one recipient's public key, not per-recipient subnames + Enhanced Access Control (the original SPEC §7 stretch scope) — that fuller version is future work, not claimed as live.
- Security is demo-grade throughout; no production key-management claims are made.

## Sponsor integrations — actually live vs. planned

| Integration | Status |
|---|---|
| JAW.id (passkey smart accounts, Sepolia) | **Live** — onboarding works end-to-end |
| World ID for Agents | **Live** — full OIDC+PKCE flow verified end-to-end against the sandbox, gating a real `approveRelease` call on Sepolia (see above) |
| ENS | **Live** — a registered Sepolia name (`releasekey.eth`) serves as a real public-key directory; content is genuinely encrypted to the key it holds (see above). Not the fuller per-recipient-subname design from SPEC §7. |

## AI use

See [`AI-USE.md`](./AI-USE.md) for which tools were used, for which files, and which decisions were human-reviewed. [`SPEC.md`](./SPEC.md) is the plan file this implementation follows. [`WORLD-FEEDBACK.md`](./WORLD-FEEDBACK.md) has feedback for the World team based on integrating World ID for Agents during this event.
