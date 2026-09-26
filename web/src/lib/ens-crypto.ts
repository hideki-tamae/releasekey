// Pure hybrid encryption (ECIES-style) to a recipient's secp256k1 public
// key. No server-only dependency here so this is testable in isolation —
// see ens-encryption.ts for the server-side ENS lookup that supplies the
// recipient's public key in the real flow.
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "crypto";
import { bytesToHex, hexToBytes, type Hex } from "viem";

export type EncryptedPayload = {
  ephemeralPublicKey: Hex;
  iv: Hex;
  ciphertext: Hex;
};

const HKDF_INFO = new TextEncoder().encode("releasekey-ecies-v1");

function deriveAesKey(sharedSecret: Uint8Array): Uint8Array {
  // The shared X coordinate is enough entropy; HKDF turns it into a
  // uniformly-random 32-byte AES-256 key, domain-separated by HKDF_INFO
  // so this key can never be reused for an unrelated purpose.
  return hkdf(sha256, sharedSecret, undefined, HKDF_INFO, 32);
}

/** Encrypts `plaintext` so that only the holder of the private key behind
 * `recipientPublicKey` can decrypt it. Safe to store/transmit the result
 * anywhere public — it reveals nothing without that private key. */
export function encryptForRecipient(
  plaintext: string,
  recipientPublicKey: Hex
): EncryptedPayload {
  const ephemeralPrivateKey = secp256k1.utils.randomPrivateKey();
  const ephemeralPublicKey = secp256k1.getPublicKey(ephemeralPrivateKey, false);

  const recipientPoint = hexToBytes(recipientPublicKey);
  const sharedSecret = secp256k1.getSharedSecret(ephemeralPrivateKey, recipientPoint);
  const aesKey = deriveAesKey(sharedSecret);

  const iv = randomBytes(12);
  const ciphertext = gcm(aesKey, iv).encrypt(new TextEncoder().encode(plaintext));

  return {
    ephemeralPublicKey: bytesToHex(ephemeralPublicKey),
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(ciphertext),
  };
}

/** Decrypts a payload produced by `encryptForRecipient`, given the
 * recipient's own private key. This is the operation only the intended
 * recipient (e.g. Bob) can perform — reference implementation for
 * whichever side actually serves decryption to the recipient. */
export function decryptAsRecipient(
  payload: EncryptedPayload,
  recipientPrivateKey: Hex
): string {
  const privKeyBytes = hexToBytes(recipientPrivateKey);
  const ephemeralPoint = hexToBytes(payload.ephemeralPublicKey);
  const sharedSecret = secp256k1.getSharedSecret(privKeyBytes, ephemeralPoint);
  const aesKey = deriveAesKey(sharedSecret);

  const plaintextBytes = gcm(aesKey, hexToBytes(payload.iv)).decrypt(
    hexToBytes(payload.ciphertext)
  );
  return new TextDecoder().decode(plaintextBytes);
}
