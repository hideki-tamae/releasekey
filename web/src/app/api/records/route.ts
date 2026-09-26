import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { encodeAbiParameters, keccak256, type Hex } from "viem";
import { createCommitment } from "@/lib/chain";

// POST /api/records
// Demo-only stand-in for "the agent prepares a release package". Content
// is synthetic — SPEC.md §3/§4: no real personal data anywhere in this
// demo. Generates a fresh recordId + salted commitments and registers
// them on-chain with the AGENT_ROLE wallet. This endpoint can never
// approve anything — createCommitment leaves the record in `Created`,
// which only APPROVER_ROLE (via the World ID callback) can move forward.
function randomHex32(): Hex {
  return `0x${randomBytes(32).toString("hex")}`;
}

export async function POST() {
  const recordId = randomHex32();
  const contentHash = randomHex32(); // stand-in for hash of the synthetic record
  const salt = randomHex32();
  const recipientNode = randomHex32(); // stand-in for an ENS-style recipient node
  const recipientSalt = randomHex32();

  const commitment = keccak256(
    encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [contentHash, salt])
  );
  const recipientCommitment = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }],
      [recipientNode, recipientSalt]
    )
  );

  try {
    const txHash = await createCommitment({ recordId, commitment, recipientCommitment });
    return NextResponse.json({ recordId, commitment, recipientCommitment, txHash });
  } catch (err) {
    console.error("createCommitment failed:", err);
    return NextResponse.json({ error: "create_commitment_failed" }, { status: 500 });
  }
}
