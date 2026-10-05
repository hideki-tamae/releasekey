import { NextRequest, NextResponse } from "next/server";
import { isHex, type Hex } from "viem";
import { DOCTOR_REPLY_CODES, threadStore, ThreadError, type DoctorReplyCode } from "@/lib/thread-store";
import { auditLog } from "@/lib/audit-log";

// POST /api/threads/:threadId/replies — the doctor replies from a fixed menu.
// Codes only, never free text, so this path carries no new content. A reply
// shares nothing and approves nothing.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  if (!isHex(threadId, { strict: true }) || threadId.length !== 66) {
    return NextResponse.json({ error: "invalid_thread_id" }, { status: 400 });
  }

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code || !(DOCTOR_REPLY_CODES as readonly string[]).includes(code)) {
    return NextResponse.json({ error: "invalid_reply_code" }, { status: 400 });
  }

  const thread = threadStore.get(threadId as Hex);
  if (!thread) {
    return NextResponse.json({ error: "thread_not_found" }, { status: 404 });
  }

  try {
    threadStore.addDoctorReply(threadId as Hex, code as DoctorReplyCode);
  } catch (err) {
    if (err instanceof ThreadError) {
      return NextResponse.json({ error: err.reason }, { status: 409 });
    }
    throw err;
  }
  auditLog.append(thread.originRecordId, "thread_reply", { details: { threadId, reply: code } });

  return NextResponse.json({ threadId, reply: code });
}
