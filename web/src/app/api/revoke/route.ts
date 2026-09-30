import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { revoke } from "@/lib/chain";
import { auditLog } from "@/lib/audit-log";

// POST /api/revoke — SPEC.md §3 item 5: "User can revoke." Only the
// APPROVER_ROLE wallet can call revoke() on-chain (see src/ReleaseKey.sol);
// this route holds that key server-side, same as the World ID callback's
// approveRelease call. The contract itself rejects revoking a record that
// isn't Created or Approved (InvalidStatus), so no extra status check is
// needed here.
export async function POST(req: NextRequest) {
  const { recordId } = (await req.json().catch(() => ({}))) as { recordId?: string };
  if (!recordId) {
    return NextResponse.json({ error: "missing_record_id" }, { status: 400 });
  }

  try {
    const txHash = await revoke(recordId as Hex);
    auditLog.append(recordId, "revoked");
    return NextResponse.json({ recordId, txHash });
  } catch (err) {
    console.error("revoke failed:", err);
    return NextResponse.json({ error: "revoke_failed" }, { status: 500 });
  }
}
