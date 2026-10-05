import { NextRequest, NextResponse } from "next/server";
import { getDoctor } from "@/lib/doctors";
import { prepareRelease } from "@/lib/prepare-release";
import { productionPrepareDeps } from "@/lib/prepare-deps";

// POST /api/records — the agent prepares a release package (SPEC-v2 §6).
//
// The pipeline (redact → risk → policy → decide, then encrypt and commit only
// if a human must approve) lives in lib/prepare-release.ts and is shared with
// thread follow-ups. A deny returns 403 and never touches the chain. Every
// step is appended to the hash-chained audit log (no content, no personal data).
//
// Only the SHARED text (redacted unless the policy says "full") is hashed,
// encrypted and committed. The original text lives only in this request's
// memory; it is never stored, logged or returned. Content is synthetic in
// the demo — SPEC.md §3/§4: no real personal data.
export async function POST(req: NextRequest) {
  const { doctorId, content } = (await req.json().catch(() => ({}))) as {
    doctorId?: string;
    content?: string;
  };

  const result = await prepareRelease(
    { doctorId, doctor: doctorId ? getDoctor(doctorId) : undefined, content },
    productionPrepareDeps
  );

  return NextResponse.json(result.body, { status: result.status });
}
