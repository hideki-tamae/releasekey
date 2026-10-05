// The "prepare" pipeline shared by a first record (POST /api/records) and a
// thread follow-up (POST /api/threads/:id/records). Extracted unchanged from
// the original route (SPEC-v2 §6) so both paths behave identically.
//
// Every step runs BEFORE any on-chain call, in this order:
//   1. redact direct identifiers (minimal disclosure)       — disclosure.ts
//   2. score what is left for re-identification risk         — reid-check.ts
//   3. load the data subject's consent policy (ENS, strict default)
//   4. ordered, fail-closed decision: deny, or require a human — release-decision.ts
// A deny never reaches createCommitment. This function never approves
// anything: approval is always a separate, fresh World ID step.
//
// Dependencies (chain, ENS, encryption, stores) are injected so the pipeline
// can be unit-tested without env vars or network. Production wiring lives in
// prepare-deps.ts.

import { encodeAbiParameters, keccak256, toBytes, type Hex } from "viem";
import type { Doctor } from "./doctors";
import type { ConsentPolicy } from "./consent-policy";
import type { EncryptedPayload } from "./ens-crypto";
import { redact, type RedactionResult } from "./disclosure";
import { assessReidentificationRisk } from "./reid-check";
import { decideRelease, DENY_REASON_TEXT } from "./release-decision";
import type { AuditDetails, AuditEventType } from "./audit-log";

export type PrepareInput = {
  doctorId: string | undefined;
  /** Resolved by the caller. Undefined means the recipient is not in the directory. */
  doctor: Doctor | undefined;
  content: string | undefined;
  /** Set for a thread follow-up. Adds threadId to the audit details. The order of follow-ups is kept by the thread store, not here. */
  threadId?: string;
};

export type PrepareDeps = {
  randomId(): Hex;
  loadPolicy(): Promise<ConsentPolicy>;
  getRecipientPublicKey(ensName: string, textRecordKey: string): Promise<Hex>;
  encrypt(text: string, publicKey: Hex): EncryptedPayload;
  createCommitment(args: { recordId: Hex; commitment: Hex; recipientCommitment: Hex }): Promise<Hex>;
  storeRecord(
    recordId: Hex,
    entry: {
      recipientEns: string;
      doctorId: string;
      encryptedContent: EncryptedPayload;
      ttlSeconds?: number;
      threadId?: string;
    }
  ): void;
  /** Keeps the refusal (no content) so it can later be the origin of a follow-up. */
  storeRefusal(recordId: Hex, entry: { recipientEns: string; doctorId: string; reason: string }): void;
  audit: { append(recordId: string, type: AuditEventType, opts?: { reason?: string; details?: AuditDetails }): unknown };
};

export type PrepareResult = {
  /** "denied": refused before the chain. "prepared": commitment created, still needs approval. "failed": an error after or during preparation. */
  outcome: "denied" | "prepared" | "failed";
  status: number;
  recordId: Hex;
  body: Record<string, unknown>;
};

export async function prepareRelease(input: PrepareInput, deps: PrepareDeps): Promise<PrepareResult> {
  const { doctor, doctorId } = input;
  const recordId = deps.randomId();

  // Thread context goes on every audit entry for this record, so the thread
  // history can be filtered out of the log.
  const threadDetails: AuditDetails = input.threadId ? { threadId: input.threadId } : {};

  const originalText =
    input.content?.trim() ||
    `Voice check-in received (synthetic demo audio). The agent prepared this record for ` +
      `${doctor?.label ?? "the recipient"} — content stays encrypted until a fresh human approval releases it.`;

  // 1–4: minimal disclosure → risk → policy → decision
  const policy = await deps.loadPolicy();
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

  deps.audit.append(recordId, "redacted", {
    details: {
      totalRedacted: disclosure.totalRedacted,
      riskScore: risk.score,
      policySource: policy.source,
      ...threadDetails,
    },
  });

  if (decision.outcome === "deny") {
    deps.audit.append(recordId, "policy_denied", {
      reason: decision.reason,
      details: { rule: decision.rule, ...threadDetails },
    });
    // A refusal with a known recipient is kept, so the doctor can book a follow-up from it.
    if (doctor) {
      deps.storeRefusal(recordId, { recipientEns: doctor.ensName, doctorId: doctor.id, reason: decision.reason });
    }
    return {
      outcome: "denied",
      status: 403,
      recordId,
      body: {
        error: "policy_denied",
        reason: decision.reason,
        message: DENY_REASON_TEXT[decision.reason],
        recordId,
        decision,
        disclosure,
      },
    };
  }

  // From here on the decision is `require_human`: we only PREPARE. Approval
  // still needs a fresh World ID verification (api/world/callback).
  const salt = deps.randomId();
  const recipientNode = deps.randomId(); // stand-in for an ENS-style recipient node
  const recipientSalt = deps.randomId();

  // Real hash of exactly what will be shared (the redacted text by default).
  const contentHash = keccak256(toBytes(sharedText));
  const commitment = keccak256(
    encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [contentHash, salt])
  );
  const recipientCommitment = keccak256(
    encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [recipientNode, recipientSalt])
  );

  let encryptedContent: EncryptedPayload;
  try {
    const recipientPublicKey = await deps.getRecipientPublicKey(doctor!.ensName, doctor!.textRecordKey);
    encryptedContent = deps.encrypt(sharedText, recipientPublicKey);
    deps.storeRecord(recordId, {
      recipientEns: doctor!.ensName,
      doctorId: doctor!.id,
      encryptedContent,
      ttlSeconds: decision.ttlSeconds,
      ...(input.threadId && { threadId: input.threadId }),
    });
  } catch (err) {
    console.error("encryption for recipient failed:", err);
    return { outcome: "failed", status: 400, recordId, body: { error: "encryption_failed" } };
  }

  try {
    const txHash = await deps.createCommitment({ recordId, commitment, recipientCommitment });
    deps.audit.append(recordId, "prepared", { details: { ttlSeconds: decision.ttlSeconds, ...threadDetails } });
    return {
      outcome: "prepared",
      status: 200,
      recordId,
      body: {
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
      },
    };
  } catch (err) {
    console.error("createCommitment failed:", err);
    return { outcome: "failed", status: 500, recordId, body: { error: "create_commitment_failed" } };
  }
}
