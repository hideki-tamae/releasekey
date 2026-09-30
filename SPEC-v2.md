# HAIS Agent v2 (ReleaseKey v2) — SPEC

> Source of truth for the v2 branch. v1 (the ETHGlobal Tokyo 2026 submission) is
> frozen on branch `v1-ethglobal-tokyo-2026` and described by [`SPEC.md`](./SPEC.md).
> AI coding agents: read this whole file before writing code. Do not expand scope beyond it.
> Author: Hideki Tamae. Japanese overview: [`docs/v2/OVERVIEW.ja.md`](./docs/v2/OVERVIEW.ja.md).

## 1. One-sentence summary

An AI agent can **prepare** a sensitive care record, but it can only ever share
**the minimum a policy allows**, only after a **fresh human approval**, and
**every refusal is as visible and auditable as every release**.

## 2. Why v2 — what ETHGlobal Tokyo 2026 taught us

Evidence (public Showcase + closing ceremony, 2026-09-27; full analysis in
`docs/v2/ANALYSIS.md`):

| Finding | Source project(s) | What v2 takes from it |
|---|---|---|
| The winning pattern was "AI does the work, a human holds final authority, the boundary is shown live". | Omamori (finalist), Airlock (World prize) | Keep the v1 invariant; make the boundary **visible** in the UI. |
| Airlock (human-consent gateway for AI) won World ID for Agents with: redaction → re-identification check → policy from ENS → human approval → hash-chained audit log. | Airlock | Add **minimal disclosure**, a **re-identification check**, **ENS-hosted policy**, and a **hash-chained audit log**. |
| Yohaku (finalist) routes agent requests to auto / human / deny with ordered rules, fails closed, and shows what it refused. | Yohaku | Add an **ordered, fail-closed decision router** whose denials are shown. |
| Omamori (elderly variant) stores family spending rules in ENS records the agent cannot edit. | Omamori (ENS) | Policy lives in **ENS text records owned by the data subject**, read fresh on every request. |
| v1's likely weaknesses (inference, not an official reason): the result was invisible on screen, there was no money flow, and sponsor requirements (e.g. a live denial path) were not shown clearly. | — | v2 UI shows *what will be shared*, *what was removed*, *the risk score*, and *every refusal*. Payment is Phase 3. |

## 3. Scope

### Phase 1 — implemented in this branch
1. **Minimal disclosure (redaction).** Before anything is encrypted, direct
   identifiers in the prepared text are replaced with typed placeholders
   (`[EMAIL_1]`, `[PHONE_1]`, `[ID_NUMBER_1]`, `[POSTAL_CODE_1]`, `[DATE_1]`,
   `[URL_1]`). Only the redacted text is encrypted, hashed and committed. The
   placeholder→original map is **never stored or returned**.
2. **Re-identification check.** A deterministic heuristic scores what remains
   after redaction (quasi-identifiers such as ages, specific places, rare
   attributes, residual numbers). Output: `score 0–100` + the signals found.
   It is a heuristic, labelled as such — not a privacy guarantee.
3. **Consent policy.** A small typed policy (max approval TTL, max
   re-identification risk, disclosure mode, allowed recipients). Loaded from
   the recipient-independent **data-subject ENS name** text records
   (`com.releasekey.policy.*`) when configured; otherwise a **strict default**.
   Unparseable or missing values fall back to the strict default (fail closed).
4. **Release decision router.** Ordered rules, first match wins, evaluated
   *before* any on-chain call. Outcomes: `deny` (with a reason) or
   `require_human` (proceed to World ID). There is **no `auto` release** — the
   v1 invariant "the agent can never release alone" is preserved. Any
   exception inside the router ⇒ `deny: router_error`.
5. **Hash-chained audit log.** Every step (prepared, redacted, policy denied,
   verification denied, approved, access granted, access refused, revoked)
   is appended as an entry whose hash covers the previous entry's hash.
   `verifyChain()` detects any edit, reorder or deletion. Entries contain
   **no content and no personal data** — only event type, recordId, reason
   codes and counts.
6. **Visible boundary UI.** The release screen shows the redacted preview,
   what categories were removed, the risk score, and the policy applied.
   The result screen shows the audit trail and its verification status.

### Phase 2 — designed, not implemented (see `docs/v2/ROADMAP.md`)
- **MynaWallet (JPKI)** professional attestation for recipients (doctors,
  care staff): a recipient must prove a real, publicly-certified identity
  before their ENS key is trusted.
- **JAW.id permissions** for the agent key: spending/time/contract-scoped
  permissions so the agent's own authority is programmatically bounded.
- **ENSv2 per-subject subnames + Enhanced Access Control**: each data subject
  owns `<id>.releasekey.eth`; the agent may edit only a status record.
- Persistent storage for records, pending releases and the audit log.

### Phase 3 — vision (not implemented)
- **Human Data Infrastructure / Data Liquidity Layer**: AI agents request
  sensitive human-experience data; access requires consent + minimal
  disclosure + proof; payment per use (e.g. x402) flows **to the person**.
- ZK proofs of "condition met" instead of disclosure.
- SOLUNA (Proof of Care) rewards; stable-value payouts (Sampo-style UX).

### Non-goals (unchanged from v1)
- No voice / face / emotion / stress / health scoring or diagnosis.
- No real personal data. Synthetic demo data only.
- No production-grade key management claims.
- The deployed `ReleaseKey.sol` is **unchanged** in Phase 1.

## 4. Data boundary (v2)

| Data | Where | On-chain? |
|---|---|---|
| Original (unredacted) text | Client memory, and server memory for the duration of one `POST /api/records` request; never stored or logged | **Never** |
| Placeholder → original map | Not stored anywhere | **Never** |
| Redacted text | Encrypted to recipient's ENS key, off-chain | **Never** |
| Redaction summary (counts per category), risk score | Off-chain record + API response | **Never** |
| Audit log entries (type, recordId, reason code, counts, prevHash, hash) | Off-chain (demo: in-memory) | **Never** (Phase 2: anchor head hash) |
| recordId, salted commitment of **redacted** text, recipient commitment, coarse events | Contract | Yes (unchanged) |

## 5. Modules (web/src/lib)

| Module | Responsibility | Tests |
|---|---|---|
| `disclosure.ts` | `redact(text) → { redactedText, summary }` | `disclosure.test.ts` |
| `reid-check.ts` | `assessReidentificationRisk(redactedText) → { score, signals }` | `reid-check.test.ts` |
| `consent-policy.ts` | `DEFAULT_POLICY`, `parsePolicy(records)` fail-closed | `consent-policy.test.ts` |
| `ens-policy.ts` | reads `com.releasekey.policy.*` text records via viem | (network; covered by parse tests) |
| `release-decision.ts` | `decideRelease(input, policy) → Decision` ordered rules | `release-decision.test.ts` |
| `audit-log.ts` | `AuditLog.append / entries / verifyChain` | `audit-log.test.ts` |

### Policy keys (ENS text records on the data subject's name)

| Key | Type | Strict default |
|---|---|---|
| `com.releasekey.policy.maxTtlSeconds` | integer 60–3600 | `900` |
| `com.releasekey.policy.maxReidRisk` | integer 0–100 | `40` |
| `com.releasekey.policy.disclosure` | `redacted` \| `full` | `redacted` |
| `com.releasekey.policy.allowedRecipients` | comma-separated doctor ids | `bob,carol` (demo) |

### Decision rules (first match wins)

1. Recipient unknown → `deny: unknown_recipient`
2. Recipient not in `allowedRecipients` → `deny: recipient_not_allowed`
3. Content empty after trimming → `deny: empty_content`
4. `disclosure=redacted` and redaction did not run → `deny: redaction_missing`
5. Risk score > `maxReidRisk` → `deny: reidentification_risk_too_high`
6. Otherwise → `require_human` with `ttlSeconds = min(policy.maxTtlSeconds, 3600)`

## 6. API changes

| Route | v1 | v2 |
|---|---|---|
| `POST /api/records` | encrypt raw text, commit | redact → risk → policy decision → **deny before any chain call** or encrypt redacted text, commit; returns `disclosure` + `decision` |
| `GET /api/world/callback` | approve on success | same + audit entries for denial/approval; TTL from policy |
| `GET /api/records/:id/content` | gate on `isReleasable` | same + audit `access_granted` / `access_refused` |
| `POST /api/revoke` | revoke | same + audit `revoked` |
| `GET /api/audit/:id` | — | **new**: entries + `verifyChain()` result |

## 7. Required tests (Phase 1)
- Redaction removes emails, phone numbers (JP + intl), 12-digit ID numbers,
  postal codes, dates, URLs; placeholders are numbered and stable per value;
  clean text is unchanged.
- Risk: clean text scores low; text with age + place + rare attribute scores
  above the default threshold; score is bounded 0–100.
- Policy: defaults on empty input; out-of-range / garbage values fall back to
  defaults; valid values parse.
- Decision: each deny rule fires in order; no path yields a release without
  `require_human`; router exception ⇒ deny.
- Audit: chain verifies; tampering with any field, deleting or reordering an
  entry breaks verification; entries never contain content fields.
- v1 tests (World ID gate, ENS crypto, contract) continue to pass.

## 8. Demo script (4 minutes, for the next hackathon)
1. **10-second problem:** "Care workers want AI help with records, but one wrong
   share of a patient's data can't be undone."
2. Speak a check-in that includes a phone number and a birth date →
   the screen shows them **replaced**, the risk score, and the policy.
3. Approve with World ID → released to Dr. Bob only; decrypt works.
4. **Refusal moment:** revoke → access is refused live; a second record with too
   many identifiers is **denied before touching the chain**.
5. Show the audit trail verifying ✓ — then show it failing if one entry is edited
   (unit test output).
