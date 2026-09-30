import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { isReleasable } from "@/lib/chain";
import { getStoredRecord } from "@/lib/record-store";
import { decryptAsRecipient } from "@/lib/ens-crypto";
import { getDoctor } from "@/lib/doctors";
import { auditLog } from "@/lib/audit-log";

// GET /api/records/:recordId/content
// Demo-only stand-in for "the recipient's own service fetches and decrypts
// their content." A real deployment would never decrypt server-side with a
// key we hold — the recipient's own client would do this with their own
// private key. Here it's done server-side purely so the demo can visibly
// show "access works while approved, and stops the instant it's revoked or
// expires" without needing a second real wallet in the browser.
//
// Gated on the exact same on-chain check a third-party /access endpoint
// (e.g. Thomas's) should use: isReleasable(recordId).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params;

  const releasable = await isReleasable(recordId as Hex);
  if (!releasable) {
    // v2: a refused access is a first-class, auditable event.
    auditLog.append(recordId, "access_refused", { reason: "not_releasable" });
    return NextResponse.json(
      { error: "not_releasable", message: "This record is not currently approved for access." },
      { status: 403 }
    );
  }

  const stored = getStoredRecord(recordId as Hex);
  if (!stored) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const doctor = getDoctor(stored.doctorId);
  const recipientPrivateKey = doctor
    ? (process.env[doctor.privateKeyEnvVar] as Hex | undefined)
    : undefined;
  if (!recipientPrivateKey) {
    return NextResponse.json({ error: "missing_recipient_key" }, { status: 500 });
  }

  try {
    const content = decryptAsRecipient(stored.encryptedContent, recipientPrivateKey);
    auditLog.append(recordId, "access_granted", { details: { recipient: stored.doctorId } });
    return NextResponse.json({
      recordId,
      recipientEns: stored.recipientEns,
      doctorId: stored.doctorId,
      content,
    });
  } catch (err) {
    console.error("decrypt failed:", err);
    return NextResponse.json({ error: "decrypt_failed" }, { status: 500 });
  }
}
