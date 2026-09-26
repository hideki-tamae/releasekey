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
release.** This is verified both by 16 passing Foundry tests and live on
Sepolia (see Deployment below).

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

## Setup

```bash
# Contracts
forge install
cp .env.example .env   # fill in DEPLOYER_PRIVATE_KEY, AGENT_WALLET_ADDRESS, APPROVER_WALLET_ADDRESS
forge test -vv
forge script script/DeployReleaseKey.s.sol:DeployReleaseKey --rpc-url sepolia --broadcast

# Frontend (passkey onboarding via JAW.id)
cd web
npm install
cp .env.local.example .env.local   # fill in NEXT_PUBLIC_JAW_API_KEY
npm run dev
```

## Live demo

TBD — frontend currently covers passkey onboarding only; the release flow
(World ID for Agents gate + on-chain approval) is being wired to the deployed
contract above.

## Known limitations

- World ID for Agents integration is not yet wired to the deployed contract (see `SPEC.md` §6 for the planned sequence).
- ENSv2 subname/text-record integration (SPEC §7) is a stretch goal and may be dropped if not genuinely working by the submission cutoff.
- Security is demo-grade throughout; no production key-management claims are made.

## Sponsor integrations — actually live vs. planned

| Integration | Status |
|---|---|
| JAW.id (passkey smart accounts, Sepolia) | **Live** — onboarding works end-to-end |
| World ID for Agents | Planned, not yet integrated |
| ENSv2 | Planned (stretch), not yet integrated |

## AI use

See [`AI-USE.md`](./AI-USE.md) (to be added) for which tools were used, for which files, and which decisions were human-reviewed. [`SPEC.md`](./SPEC.md) is the plan file this implementation follows.
