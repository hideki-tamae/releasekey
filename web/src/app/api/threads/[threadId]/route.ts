import { NextRequest, NextResponse } from "next/server";
import { isHex, type Hex } from "viem";
import { threadStore } from "@/lib/thread-store";
import { auditLog, verifyChain } from "@/lib/audit-log";

// GET /api/threads/:threadId — the thread's state, its events, its follow-up
// record ids, and its slice of the audit log. The whole audit chain is verified
// on every read, so a tampered entry shows up here too.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  if (!isHex(threadId, { strict: true }) || threadId.length !== 66) {
    return NextResponse.json({ error: "invalid_thread_id" }, { status: 400 });
  }

  const thread = threadStore.get(threadId as Hex);
  if (!thread) {
    return NextResponse.json({ error: "thread_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    thread,
    audit: {
      entries: auditLog.entriesForThread(threadId),
      chain: verifyChain(auditLog.entries()),
    },
  });
}
