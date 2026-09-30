import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { encodeAbiParameters, keccak256, toBytes, type Hex } from "viem";
import { createCommitment } from "@/lib/chain";
import { getRecipientPublicKey } from "@/lib/ens-encryption";
import { encryptForRecipient } from "@/lib/ens-crypto";
import { storeRecord } from "@/lib/record-store";
import { getDoctor } from "@/lib/doctors";
import { redact, type RedactionResult } from "@/lib/disclosure";
import { assessReidentificationRisk } from "@/lib/reid-check";
import { loadConsentPolicy } from "@/lib/ens-policy";
import { decideRelease, DENY_REASON_TEXT } from "@/lib/release-decision";
import { auditLog } from "@/lib/audit-log";

// POST /api/records — the agent prepares a release package (SPEC-v2 §6).
//
// v2 pipeline, all BEFORE any on-chain call:
//   1. redact direct identifiers (minimal disclosure)       — lib/disclosure.ts
//   2. score what is left for re-identification risk         — lib/reid-check.ts
//   3. load the data subject's consent policy (ENS, strict default)
//   4. ordered, fail-closed decision: deny, or require a human — lib/release-decision.ts
// A deny returns 403 with the reason and never touches the chain. Every step
// is appended to the hash-chained audit log (no content, no personal data).
//
// Only the SHARED text (redacted unless the policy says "full") is hashed,
// encrypted and committed. The original text lives only in this request's
// memory; it is never stored, logged or returned. Content is synthetic in
// the demo — SPEC.md §3/§4: no real personal data.
function randomHex32(): Hex {
  return `0x${randomBytes(32).toString("hex")}`;
}

export async function POST(req: NextRequest) {
  const { doctorId, content: providedContent } = (await req.json().catch(() => ({}))) as {
    doctorId?: string;
    content?: string;
  };

  const doctor = doctorId ? getDoctor(doctorId) : undefined;
  const recordId = randomHex32();

  const originalText =
    providedContent?.trim() ||
    `Voice check-in received (synthetic demo audio). The agent prepared this record for ` +
      `${doctor?.label ?? "the recipient"} — content stays encrypted until a fresh human approval releases it.`;

  // 1–4: minimal disclosure → risk → policy → decision
  const policy = await loadConsentPolicy();
  const redaction: RedactionResult | null = policy.disclosure === "redacted" ? redact(originalText) : null;
  const sharedText = redaction ? redaction.redactedText : originalText;
  const risk = assessReidentificationRisk(sharedText);
  const decision = decideRelease(
    { recipientId: doctorId, recipientKnown: Boolean(doctor), sharedText, redaction, risk },
    policy
  );

  const disclosure = {
    mode: policy.disclosure,
    sharedText,
    removed: redaction?.summary ?? null,
    totalRedacted: redaction?.totalRedacted ?? 0,
    risk,
    policy: {
      source: policy.source,
      maxReidRisk: policy.maxReidRisk,
      maxTtlSeconds: policy.maxTtlSeconds,
      disclosure: policy.disclosure,
    },
  };

  auditLog.append(recordId, "redacted", {
    details: {
      totalRedacted: disclosure.totalRedacted,
      riskScore: risk.score,
      policySource: policy.source,
    },
  });

  if (decision.outcome === "deny") {
    auditLog.append(recordId, "policy_denied", { reason: decision.reason, details: { rule: decision.rule } });
    return NextResponse.json(
      {
        error: "policy_denied",
        reason: decision.reason,
        message: DENY_REASON_TEXT[decision.reason],
        recordId,
        decision,
        disclosure,
      },
      { status: 403 }
    );
  }

  // From here on the decision is `require_human`: we only PREPARE. Approval
  // still needs a fresh World ID verification (api/world/callback).
  const salt = randomHex32();
  const recipientNode = randomHex32(); // stand-in for an ENS-style recipient node
  const recipientSalt = randomHex32();

  // Real hash of exactly what will be shared (the redacted text by default).
  const contentHash = keccak256(toBytes(sharedText));
  const commitment = keccak256(
    encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [contentHash, salt])
  );
  const recipientCommitment = keccak256(
    encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [recipientNode, recipientSalt])
  );

  let encryptedContent;
  try {
    const recipientPublicKey = await getRecipientPublicKey(doctor!.ensName, doctor!.textRecordKey);
    encryptedContent = encryptForRecipient(sharedText, recipientPublicKey);
    storeRecord(recordId, {
      recipientEns: doctor!.ensName,
      doctorId: doctor!.id,
      encryptedContent,
      ttlSeconds: decision.ttlSeconds,
    });
  } catch (err) {
    console.error("encryption for recipient failed:", err);
    return NextResponse.json({ error: "encryption_failed" }, { status: 400 });
  }

  try {
    const txHash = await createCommitment({ recordId, commitment, recipientCommitment });
    auditLog.append(recordId, "prepared", { details: { ttlSeconds: decision.ttlSeconds } });
    return NextResponse.json({
      recordId,
      commitment,
      recipientCommitment,
      contentHash,
      salt,
      txHash,
      decision,
      disclosure,
      doctorId: doctor!.id,
      recipientEns: doctor!.ensName,
      encryptedContent,
    });
  } catch (err) {
    console.error("createCommitment failed:", err);
    return NextResponse.json({ error: "create_commitment_failed" }, { status: 500 });
  }
}
