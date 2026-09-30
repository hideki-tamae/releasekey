import { NextRequest, NextResponse } from "next/server";
import { auditLog, verifyChain } from "@/lib/audit-log";

// GET /api/audit/:recordId — SPEC-v2 §6.
// Returns this record's audit entries plus whether the WHOLE chain (all
// records, in order) still verifies. Entries contain no content and no
// personal data by construction (see lib/audit-log.ts).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params;
  const all = auditLog.entries();
  return NextResponse.json({
    recordId,
    entries: all.filter((e) => e.recordId === recordId),
    chain: { length: all.length, head: auditLog.head(), ...verifyChain(all) },
  });
}
