import { NextRequest, NextResponse } from "next/server";
import { isHex, type Hex } from "viem";
import { getDoctor } from "@/lib/doctors";
import { prepareRelease } from "@/lib/prepare-release";
import { productionPrepareDeps } from "@/lib/prepare-deps";
import { threadStore, ThreadError } from "@/lib/thread-store";

// POST /api/threads/:threadId/records — prepare a follow-up record in a thread.
//
// Same pipeline as POST /api/records (redact → risk → policy → decide, and
// encrypt + commit only when a human must approve). A follow-up is a NEW
// record with its own recordId: it needs its own fresh World ID approval at
// /api/world/authorize?recordId=…. This route never approves anything, and
// the thread carries no approval that could carry over to the next record.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  if (!isHex(threadId, { strict: true }) || threadId.length !== 66) {
    return NextResponse.json({ error: "invalid_thread_id" }, { status: 400 });
  }
  const id = threadId as Hex;

  const thread = threadStore.get(id);
  if (!thread) {
    return NextResponse.json({ error: "thread_not_found" }, { status: 404 });
  }
  if (thread.status !== "open") {
    return NextResponse.json({ error: "thread_closed" }, { status: 409 });
  }

  const { content } = (await req.json().catch(() => ({}))) as { content?: string };
  if (!content?.trim()) {
    return NextResponse.json({ error: "content_required" }, { status: 400 });
  }

  const result = await prepareRelease(
    { doctorId: thread.doctorId, doctor: getDoctor(thread.doctorId), content, threadId },
    productionPrepareDeps
  );

  if (result.outcome === "denied") {
    // A refusal is part of the thread's history, shown next to the releases.
    threadStore.recordDenied(id, result.recordId);
    return NextResponse.json(result.body, { status: result.status });
  }

  if (result.outcome === "failed") {
    return NextResponse.json(result.body, { status: result.status });
  }

  try {
    const sequence = threadStore.attachRecord(id, result.recordId);
    return NextResponse.json({ ...result.body, threadId: id, sequence }, { status: result.status });
  } catch (err) {
    if (err instanceof ThreadError) {
      return NextResponse.json({ error: err.reason }, { status: 409 });
    }
    throw err;
  }
}
