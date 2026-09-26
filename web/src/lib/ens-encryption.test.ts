import { describe, it, expect } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex, type Hex } from "viem";
import { encryptForRecipient, decryptAsRecipient } from "./ens-crypto";

function generateKeypair() {
  const privateKey = secp256k1.utils.randomPrivateKey();
  const publicKey = secp256k1.getPublicKey(privateKey, false);
  return { privateKey: bytesToHex(privateKey) as Hex, publicKey: bytesToHex(publicKey) as Hex };
}

describe("ens-encryption", () => {
  it("the recipient can decrypt what was encrypted to their public key", () => {
    const bob = generateKeypair();
    const plaintext = "synthetic record content";

    const payload = encryptForRecipient(plaintext, bob.publicKey);
    const decrypted = decryptAsRecipient(payload, bob.privateKey);

    expect(decrypted).toBe(plaintext);
  });

  it("nobody else's private key can decrypt it", () => {
    const bob = generateKeypair();
    const charlie = generateKeypair();

    const payload = encryptForRecipient("secret", bob.publicKey);

    expect(() => decryptAsRecipient(payload, charlie.privateKey)).toThrow();
  });

  it("produces a different ciphertext each time (fresh ephemeral key per call)", () => {
    const bob = generateKeypair();

    const first = encryptForRecipient("same message", bob.publicKey);
    const second = encryptForRecipient("same message", bob.publicKey);

    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.ephemeralPublicKey).not.toBe(second.ephemeralPublicKey);
  });
});
