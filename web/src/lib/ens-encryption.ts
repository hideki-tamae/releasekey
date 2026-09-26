// Server-side ENS lookup for the recipient's encryption public key. The
// actual encryption math lives in ens-crypto.ts (kept free of server-only
// so it stays unit-testable) — this file is the boundary that fetches a
// key from ENS before handing it to that pure crypto layer.
import "server-only";
import type { Hex } from "viem";
import { publicClient } from "./chain";

export { encryptForRecipient, decryptAsRecipient, type EncryptedPayload } from "./ens-crypto";

/** Looks up a recipient's encryption public key from an ENS text record.
 * Multiple recipients can share one ENS name by using distinct text-record
 * keys (e.g. `com.releasekey.encryptionPubKey` for Bob,
 * `com.releasekey.encryptionPubKey.carol` for Carol) — see doctors.ts.
 * Never guess or accept this key from client input — always resolve it
 * fresh from ENS. */
export async function getRecipientPublicKey(
  ensName: string,
  textRecordKey = "com.releasekey.encryptionPubKey"
): Promise<Hex> {
  const value = await publicClient.getEnsText({ name: ensName, key: textRecordKey });
  if (!value) {
    throw new Error(`No encryption public key found for ${ensName} (${textRecordKey})`);
  }
  return value as Hex;
}
