import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { getStoredRecord } from "@/lib/record-store";

// GET /api/records/:recordId/stored
// Shows the raw stored (still-encrypted) record, with no approval gate —
// safe to expose freely, since it's ciphertext: unreadable without the
// recipient's private key regardless of on-chain approval status. This is
// the transparency counterpart to /content (which requires isReleasable
// and returns the decrypted plaintext).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params;

  const stored = getStoredRecord(recordId as Hex);
  if (!stored) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    recordId,
    recipientEns: stored.recipientEns,
    storedAt: new Date(stored.createdAt).toISOString(),
    storageLocation: "In-memory on the ReleaseKey server (demo-grade; see lib/record-store.ts)",
    encryptedContent: stored.encryptedContent,
  });
}
