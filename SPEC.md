# ReleaseKey — SPEC

> Plan file for ETHGlobal Tokyo 2026. This document is the source of truth for implementation.
> AI coding agents: read this whole file before writing code. Do not expand scope beyond it.

## 1. One-sentence summary

An AI agent can **prepare** a sensitive record for sharing, but can **never release it alone** — every release requires a fresh, backend-validated human verification at the moment of release, and the chain stores only a minimal commitment, never content or personal data.

## 2. Problem

People who need to share sensitive records (with legal aid, a support worker, etc.) increasingly get help from AI agents. Delegating preparation is useful; delegating the **release decision** is dangerous. We need a hard gate that proves a **human**, not the agent, authorized a specific consequential action — right before it happens.

Why a chain at all: when the party holding a record may have an incentive to alter or deny it, a neutral, append-only log lets multiple parties later verify *that a specific commitment existed and was approved/revoked in a given order*, without trusting any single operator. The chain does **not** prove the record is true, complete, or voluntary.

## 3. Scope

### In scope (demo)
1. Passkey sign-in (JAW.id on Sepolia) — **already working**.
2. Agent prepares a release package for a **synthetic** record and registers a commitment on-chain.
3. User clicks "Release" → **fresh World ID for Agents verification** → backend validates → backend submits the on-chain approval → a short-lived release envelope is issued.
4. Failure paths (denied / cancelled / expired / invalid) → **nothing is released, no approval tx**, UI explains why.
5. User can revoke.
6. ENSv2 (stretch, only if genuinely working): recipient subnames + Enhanced Access Control so the agent can edit **only** a status text record.

### Out of scope / non-goals
- No voice, face, emotion, stress, or health scoring. Not a diagnostic or surveillance tool.
- No employer/admin dashboard. The data subject alone controls release.
- No real personal data anywhere. Synthetic demo data only.
- No production-grade key management claims. Security is demo-grade and labelled as such.
- No x402 / payments.

## 4. Data boundary (critical)

| Data | Where | On-chain? |
|---|---|---|
| Record content, files, names, recipient details, exact timestamps, consent text | Client / encrypted off-chain storage | **Never** |
| Salt, keys, plaintext hashes | Client / server secret storage | **Never** |
| Random record ID (`bytes32`) | Contract | Yes |
| Salted commitment `keccak256(abi.encode(contentHash, salt))` | Contract | Yes |
| Recipient commitment `keccak256(abi.encode(recipientNode, recipientSalt))` | Contract | Yes (hides who the recipient is) |
| Coarse events: Created / Approved / Revoked | Contract events | Yes |

Wording rule: a salted hash is **publicly visible but only verifiable by someone holding the salt**. Never describe it as "only revealable to the key holder".

Known trade-offs to state honestly in README and pitch:
- On-chain events cannot be deleted or corrected. Off-chain deletion does not erase them.
- Wallet addresses and event timing are metadata and can be linkable.
- Losing keys/salts means the owner cannot prove what a commitment refers to.

## 5. Smart contract — `ReleaseKey.sol` (Foundry, Sepolia)

Delete the default `Counter.sol` scaffold. Use OpenZeppelin `AccessControl`.

### Roles
- `DEFAULT_ADMIN_ROLE` — deployer.
- `AGENT_ROLE` — the agent's wallet. Can **create** only.
- `APPROVER_ROLE` — the backend relayer wallet. Can approve **only after** the backend validates a fresh World ID verification. Can also revoke on the user's request.

The agent wallet must **not** hold `APPROVER_ROLE`. This separation is the core invariant.

### Storage
```solidity
enum Status { None, Created, Approved, Revoked }

struct Record {
    bytes32 commitment;
    bytes32 recipientCommitment;
    uint64  approvedUntil;   // 0 until approved
    Status  status;
}

mapping(bytes32 => Record) public records;          // recordId => Record
mapping(bytes32 => bool)   public usedVerification; // prevents replay of one verification
```

### Functions
```solidity
function createCommitment(bytes32 recordId, bytes32 commitment, bytes32 recipientCommitment)
    external onlyRole(AGENT_ROLE);
// require status == None; set Created; emit Created

function approveRelease(bytes32 recordId, bytes32 verificationRef, uint64 ttlSeconds)
    external onlyRole(APPROVER_ROLE);
// require status == Created; require !usedVerification[verificationRef];
// require 0 < ttlSeconds <= 1 hours; mark verificationRef used;
// approvedUntil = block.timestamp + ttl; status = Approved; emit Approved

function revoke(bytes32 recordId) external onlyRole(APPROVER_ROLE);
// require status == Created || Approved; status = Revoked; emit Revoked

function isReleasable(bytes32 recordId) external view returns (bool);
// status == Approved && block.timestamp <= approvedUntil
```

`verificationRef` = hash of the validated verification result bound to this `recordId` (see §6). It is not personal data.

### Events
```solidity
event Created(bytes32 indexed recordId);
event Approved(bytes32 indexed recordId, uint64 approvedUntil);
event Revoked(bytes32 indexed recordId);
```

### Required tests (`forge test`)
- Agent can create; non-agent cannot.
- **Agent cannot approve.** (core invariant)
- Approver can approve a Created record; cannot approve None/Revoked/already Approved.
- Same `verificationRef` cannot be used twice.
- `isReleasable` false after `approvedUntil`, false after revoke.
- TTL bounds enforced.

Deploy to Sepolia and verify on Etherscan. Record the address in README.

## 6. World ID for Agents — release gate

Docs / sandbox: http://sandbox.auth.world.org/docs (official event dev environment). Follow the docs for exact API shapes; do not guess them.

### Sequence
1. Agent (server-side, `AGENT_ROLE` key) calls `createCommitment`.
2. UI shows the prepared package and a **Release** button.
3. User clicks Release → backend creates a verification request **bound to `recordId`** (use recordId as the action/signal context if the API supports it) → user completes verification.
4. Backend validates the result **server-side**. Never trust a client-only response. Never expose client secrets.
5. Valid → backend (`APPROVER_ROLE` key) calls `approveRelease(recordId, verificationRef, ttl)` → issues a short-lived release envelope (demo: signed, expiring link to the synthetic package).
6. Invalid / denied / cancelled / expired → **no transaction, no envelope**. UI shows the reason.

### Required backend tests
- Unvalidated or tampered response → no approval call.
- Expired/cancelled → no approval call.
- Verification for recordId A cannot approve recordId B.

If the official integration cannot be completed, a mock may exist **only** behind a dev-only flag, clearly labelled, and the World prize must not be claimed.

## 7. ENSv2 (stretch — only if real on Sepolia)

Docs: https://docs.ens.domains/ensv2/overview

- Parent: `releasekey.eth` (ENSv2 on Sepolia).
- Recipient subnames, e.g. `legal-aid.releasekey.eth`, with non-sensitive text records:
  - `releasekey.verified` — `true` / `false`
  - `releasekey.entityType` — e.g. `legal-aid`
- The data subject's own subname carries **no** additional metadata.
- **Enhanced Access Control:** grant the agent wallet permission to edit **only** a status text record (e.g. `releasekey.agentStatus`), nothing else. This mirrors the core idea — the agent can prepare, not release — and is the central ENSv2 feature to demo.
- The collaborator's burner wallet receives roles via EAC. **Never share private keys.**
- No hard-coded values in the demo. If it is not working by the cutoff, remove ENS from the submission.

## 8. Repo hygiene & ETHGlobal rules

- Small, frequent, meaningful commits. **No single giant final commit.**
- Never commit `.env`, keys, credentials, private PDFs, or real personal data. Provide `.env.example` with placeholders.
- Disclose any pre-existing work in README (what existed before kickoff vs. built during the event).
- `README.md`: one-sentence summary, architecture diagram, data boundary table, setup/test/demo steps, deployed contract address, live demo URL, known limitations, which sponsor integrations are **actually live**.
- `AI-USE.md`: which tools were used (Claude, Gemini, etc.), for which files, and which decisions were made/reviewed by humans. Keep this SPEC and key prompts in the repo.
- `WORLD-FEEDBACK.md`: time to first success, friction, missing capability/docs, the single highest-impact improvement.

## 9. Submission checklist

- [x] Public repo with commit history — `github.com/hideki-tamae/releasekey`
- [x] Contract deployed + verified on Sepolia — `0x56eDe4FbDED72B0e05F3Cc92bD41F98a74549686`
- [x] Live demo URL (deployed, working end to end) — https://releasekey.vercel.app, confirmed working live on 2026-09-26
- [ ] Demo video, 2–4 min, own voice, showing success path **and** failure path
- [ ] Project page: detailed description + screenshots
- [ ] Partner logos selected on dashboard (World; ENS only if live)
- [x] README / AI-USE.md / WORLD-FEEDBACK.md present
- [ ] Final scan: no secrets or real data in repo (re-check after ENS merge)
- [ ] Merge Thomas's ENS work

Deadline: **Sun Sep 27, 09:00 JST.** Internal target: draft submitted **Sat 22:00 JST**.

## 10. Judging & rules (ETHGlobal Tokyo 2026 kickoff slides + official rules)

- **Finalist requirements:** auditable repo; open source, **deployed and live**; demo video in the submission; team attends **live finalist judging**.
- **Finalist judging:** separate judges from partner judging; **4 min demo + 3 min Q&A**. Do not prepare last minute.
- **Partner judging:** select partner logos on the dashboard; can present before or after the finalist slot.
- **Good submission:** record a video; **fewer slides, more demo**; many small commits / small diffs; detailed project page with screenshots.
- **AI use:** all AI tools allowed; we will be **asked to explain how AI was used**; plan files (this SPEC) belong in the repo.
- **Video:** 2–4 min, 720p+, a human voice (no AI voiceover).
- **Pre-existing work:** must be disclosed; undisclosed prior work can lead to disqualification. Single large commits are presumed ineligible.
- Judges historically favor novel, working experiments over polished reuse.

Implication for every decision: a small flow that **really works live** beats a large feature set that is mocked.

## 11. Priority order (if time runs short, cut from the bottom)

1. Contract + tests + Sepolia deploy
2. World ID gate with backend validation + failure path
3. End-to-end UI, deployed
4. Video + README + submission
5. ENSv2 integration
