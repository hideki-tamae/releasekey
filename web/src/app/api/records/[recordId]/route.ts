import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { getRecord, isReleasable } from "@/lib/chain";

// GET /api/records/:recordId — read-only status check, for a third party
// (e.g. Thomas's /access endpoint) to gate on before serving content.
// No signing, no state change: just reflects the on-chain record status.
const STATUS_LABELS = ["None", "Created", "Approved", "Revoked"] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params;

  try {
    const [record, releasable] = await Promise.all([
      getRecord(recordId as Hex),
      isReleasable(recordId as Hex),
    ]);

    return NextResponse.json({
      recordId,
      status: STATUS_LABELS[record.status] ?? "Unknown",
      releasable,
      approvedUntil: Number(record.approvedUntil),
    });
  } catch (err) {
    console.error("record status lookup failed:", err);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
}
