import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { encodeAbiParameters, keccak256, toBytes, type Hex } from "viem";
import { createCommitment } from "@/lib/chain";
import { getRecipientPublicKey } from "@/lib/ens-encryption";
import { encryptForRecipient } from "@/lib/ens-crypto";
import { storeRecord } from "@/lib/record-store";

// POST /api/records
// Demo-only stand-in for "the agent prepares a release package". Content
// is synthetic — SPEC.md §3/§4: no real personal data anywhere in this
// demo. Generates a fresh recordId + salted commitments and registers
// them on-chain with the AGENT_ROLE wallet. This endpoint can never
// approve anything — createCommitment leaves the record in `Created`,
// which only APPROVER_ROLE (via the World ID callback) can move forward.
//
// Optional `content`: the real record text (e.g. a transcribed voice
// check-in). `contentHash` is keccak256 of this *actual* content — not a
// random placeholder — so the on-chain commitment is genuinely verifiable:
// anyone who is later shown the plaintext can recompute
// keccak256(content, salt) and check it against the on-chain commitment
// to prove it hasn't been altered since it was prepared. Falls back to a
// fixed synthetic string if no content is given (e.g. calls that don't
// use the voice check-in UI).
//
// Optional `recipientEns`: if given, this same content is actually
// encrypted to that recipient's public key (published as an ENS text
// record — see lib/ens-encryption.ts). Only the recipient's private key
// can ever decrypt `encryptedContent`; we never see it in the clear once
// this returns, and neither does anyone reading the chain or ENS.
function randomHex32(): Hex {
  return `0x${randomBytes(32).toString("hex")}`;
}

export async function POST(req: NextRequest) {
  const { recipientEns, content: providedContent } = (await req.json().catch(() => ({}))) as {
    recipientEns?: string;
    content?: string;
  };

  const recordId = randomHex32();
  const salt = randomHex32();
  const recipientNode = randomHex32(); // stand-in for an ENS-style recipient node
  const recipientSalt = randomHex32();

  const content =
    providedContent?.trim() ||
    `Voice check-in received (synthetic demo audio, record ${recordId}). ` +
      `The agent prepared this record for ${recipientEns ?? "the recipient"} — content stays ` +
      `encrypted until a fresh human approval releases it.`;

  // Real hash of the real content — verifiable by anyone who later sees
  // the plaintext, not a decorative placeholder.
  const contentHash = keccak256(toBytes(content));

  const commitment = keccak256(
    encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [contentHash, salt])
  );
  const recipientCommitment = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }],
      [recipientNode, recipientSalt]
    )
  );

  let encryptedContent;
  if (recipientEns) {
    try {
      const recipientPublicKey = await getRecipientPublicKey(recipientEns);
      encryptedContent = encryptForRecipient(content, recipientPublicKey);
      storeRecord(recordId, { recipientEns, encryptedContent });
    } catch (err) {
      console.error("encryption for recipient failed:", err);
      return NextResponse.json({ error: "encryption_failed" }, { status: 400 });
    }
  }

  try {
    const txHash = await createCommitment({ recordId, commitment, recipientCommitment });
    return NextResponse.json({
      recordId,
      commitment,
      recipientCommitment,
      contentHash,
      salt,
      txHash,
      ...(encryptedContent && { recipientEns, encryptedContent }),
    });
  } catch (err) {
    console.error("createCommitment failed:", err);
    return NextResponse.json({ error: "create_commitment_failed" }, { status: 500 });
  }
}
