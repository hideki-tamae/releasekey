import { NextRequest, NextResponse } from "next/server";
import { isHex, type Hex } from "viem";
import { randomBytes } from "crypto";
import { getStoredRecord } from "@/lib/record-store";
import { getDoctor } from "@/lib/doctors";
import { threadStore } from "@/lib/thread-store";
import { originEligibility } from "@/lib/origin-eligibility";
import { auditLog } from "@/lib/audit-log";

// POST /api/threads — the doctor books a follow-up from an existing record
// (SPEC-v2 §3, Phase 1.5 part 2). Opening a thread shares NOTHING: it only
// links the doctor to the record. Every follow-up share needs its own fresh
// human approval, via POST /api/threads/:threadId/records.
//
// Demo note: the doctor is not authenticated here. Anyone holding the
// recordId can book (same bearer-capability limitation as recordId itself).
export async function POST(req: NextRequest) {
  const { recordId } = (await req.json().catch(() => ({}))) as { recordId?: string };

  if (!recordId || !isHex(recordId, { strict: true }) || recordId.length !== 66) {
    return NextResponse.json({ error: "invalid_record_id" }, { status: 400 });
  }
  const origin = recordId as Hex;

  const stored = getStoredRecord(origin);
  if (!stored) {
    return NextResponse.json({ error: "record_not_found" }, { status: 404 });
  }
  // A thread is opened from a first record, not from a follow-up inside one.
  if (stored.threadId) {
    return NextResponse.json({ error: "record_already_in_thread" }, { status: 400 });
  }
  if (!getDoctor(stored.doctorId)) {
    return NextResponse.json({ error: "unknown_recipient" }, { status: 400 });
  }

  // One thread per origin record: booking again returns the existing thread.
  const existing = threadStore.findByOrigin(origin);
  if (existing) {
    return NextResponse.json({ threadId: existing.threadId, existing: true });
  }

  // The origin must have a final decision: approved, revoked, or refused.
  // A record still awaiting approval cannot start a thread (see thread-origin.ts).
  const eligibility = await originEligibility(origin, stored);
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.reason }, { status: 409 });
  }

  const threadId = `0x${randomBytes(32).toString("hex")}` as Hex;
  threadStore.open(threadId, stored.doctorId, origin);
  auditLog.append(origin, "thread_opened", { details: { threadId } });

  return NextResponse.json({ threadId }, { status: 201 });
}
