// Server-side chain access. NEVER import this from a client component —
// it holds the AGENT_ROLE and APPROVER_ROLE private keys.
//
// Core invariant (see SPEC.md §5 and src/ReleaseKey.sol): the agent wallet
// can only create commitments; only the approver wallet, acting after a
// backend-validated fresh World ID verification, can approve or revoke.
// These two wallets are deliberately kept in separate clients below so
// that no code path can accidentally call approveRelease with the agent
// key.

import "server-only";
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { releaseKeyAbi } from "./releasekey-abi";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const CONTRACT_ADDRESS = requiredEnv("RELEASEKEY_CONTRACT_ADDRESS") as Address;

const transport = http(requiredEnv("SEPOLIA_RPC_URL"));

export const publicClient = createPublicClient({
  chain: sepolia,
  transport,
});

const agentAccount = privateKeyToAccount(requiredEnv("AGENT_PRIVATE_KEY") as Hex);
const approverAccount = privateKeyToAccount(requiredEnv("APPROVER_PRIVATE_KEY") as Hex);

if (agentAccount.address.toLowerCase() === approverAccount.address.toLowerCase()) {
  // Defeats the whole point of the project — fail loudly, not silently.
  throw new Error(
    "AGENT_PRIVATE_KEY and APPROVER_PRIVATE_KEY resolve to the same address"
  );
}

const agentWalletClient = createWalletClient({
  account: agentAccount,
  chain: sepolia,
  transport,
});

const approverWalletClient = createWalletClient({
  account: approverAccount,
  chain: sepolia,
  transport,
});

/** Called only by the agent flow. Never gate this behind a World ID check —
 * "create" is preparation, not release. */
export async function createCommitment(args: {
  recordId: Hex;
  commitment: Hex;
  recipientCommitment: Hex;
}): Promise<Hex> {
  const hash = await agentWalletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: releaseKeyAbi,
    functionName: "createCommitment",
    args: [args.recordId, args.commitment, args.recipientCommitment],
  });
  // Wait for inclusion before returning: the release flow can reach
  // approveRelease within seconds (fast World ID login), and if this
  // commitment isn't mined yet the record is still Status.None on-chain,
  // so approveRelease reverts with InvalidStatus.
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/** Called only from the World ID callback, only after verifyWorldIdToken()
 * has succeeded for THIS recordId. `verificationRef` must be derived from
 * the verified token (see release-flow.ts) — never accept one from the
 * client. */
export async function approveRelease(args: {
  recordId: Hex;
  verificationRef: Hex;
  ttlSeconds: number;
}): Promise<Hex> {
  return approverWalletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: releaseKeyAbi,
    functionName: "approveRelease",
    args: [args.recordId, args.verificationRef, BigInt(args.ttlSeconds)],
  });
}

export async function revoke(recordId: Hex): Promise<Hex> {
  const hash = await approverWalletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: releaseKeyAbi,
    functionName: "revoke",
    args: [recordId],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function isReleasable(recordId: Hex): Promise<boolean> {
  return publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: releaseKeyAbi,
    functionName: "isReleasable",
    args: [recordId],
  });
}

export async function getRecord(recordId: Hex) {
  const [commitment, recipientCommitment, approvedUntil, status] =
    await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: releaseKeyAbi,
      functionName: "records",
      args: [recordId],
    });
  return { commitment, recipientCommitment, approvedUntil, status };
}
