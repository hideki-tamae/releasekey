# HAIS Agent — Roadmap (v2 onward)

Author: Hideki Tamae · 2026-09-30 · Status legend: ✅ done · 🟡 designed · 🔭 vision

## Phase 1 — Visible boundary (this branch) ✅

| Item | Inspired by | Status |
|---|---|---|
| Minimal disclosure (typed redaction, no un-redact map) | Airlock | ✅ `web/src/lib/disclosure.ts` |
| Re-identification heuristic (0–100, signals shown) | Airlock | ✅ `web/src/lib/reid-check.ts` |
| Consent policy in ENS text records, strict fail-closed default | Omamori (ENS), Airlock | ✅ `consent-policy.ts`, `ens-policy.ts` |
| Ordered, fail-closed decision router; no auto-release | Yohaku | ✅ `release-decision.ts` |
| Hash-chained audit log incl. refusals; no PII by construction | Airlock | ✅ `audit-log.ts`, `GET /api/audit/:id` |
| UI: share preview, risk bar, refusal card, audit trail | Omamori demo style | ✅ |
| Re-run the approval path live (World ID sandbox → Sepolia) | — | ⏳ needs a human with the keys |

## Phase 2 — Trusted parties & persistence 🟡

1. **Recipient attestation with MynaWallet (JPKI).** A doctor / care worker
   proves a publicly-certified identity once; the directory marks the ENS key
   as attested. `doctors.ts` gains `attestation: { method: "jpki", verifiedAt }`
   and rule 1 of the router requires it. Legal review first — use the JPKI
   signature certificate, never the My Number itself.
2. **Bounded agent key with JAW.id permissions.** The AGENT_ROLE key becomes a
   JAW smart account with a permission: only `ReleaseKey.createCommitment`,
   daily call limit, expiry. Even a compromised agent can only *prepare*.
3. **ENSv2 per-subject names + Enhanced Access Control.** `<id>.releasekey.eth`
   owned by the data subject; policy records writable only by the subject;
   agent may write only `releasekey.agentStatus` (SPEC.md §7, finally live).
4. **Persistence.** Records, pending releases and the audit log move from
   memory to a database; the audit **head hash is anchored on-chain** daily.
5. **Model-based re-identification test** (local model, Airlock-style) as a
   second opinion next to the heuristic.
6. **Facility dashboard** (Curvegrid MultiBaas events/webhooks) for care
   organisations: who approved what, when — never the content.

## Phase 3 — Human Data Infrastructure / Data Liquidity Layer 🔭

```
Person ─► consent ─► access right ─► minimal disclosure ─► proof (ZK)
       ─► AI agent uses it ─► pays per use (x402) ─► payment goes to the person
```

- AI agents become customers of human care-experience data (cf. Yohaku), but
  only through this layer.
- ZK proofs of "condition met" replace disclosure where possible.
- SOLUNA (Proof of Care) rewards; stable-value payouts with a Sampo-simple UX.
- Guardrails first: consent withdrawal and purpose limitation must exist
  before any payment flow (sensitive personal data under Japan's APPI).

## Next hackathon checklist

- [ ] First 10 seconds: whose loss, cut by how much
- [ ] Show the **refusal** live (policy denial + revoke → access refused)
- [ ] Pick at most 2 sponsor tracks; map each requirement to code 1:1 in README
- [ ] Showcase text with numbers and failure cases, 2–4 min video with own voice
