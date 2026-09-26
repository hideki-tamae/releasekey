// Demo recipient directory. Both doctors' public keys live as text
// records on the same ENS name (releasekey.eth) — see ENS-FEEDBACK.md for
// why per-recipient subnames weren't used tonight (unverified ENSv2
// write interface risk). This file is the single source of truth for
// which text-record key belongs to which doctor, used by both the client
// (to render the picker) and the server (to know what to look up).
export type Doctor = {
  id: string;
  label: string;
  ensName: string;
  textRecordKey: string;
  /** Env var holding this doctor's private key — demo-only, see
   * README's Known limitations (real decryption must happen on the
   * recipient's own client, never server-side like this). */
  privateKeyEnvVar: string;
};

export const DOCTORS: Doctor[] = [
  {
    id: "bob",
    label: "Bob (the doctor)",
    ensName: "releasekey.eth",
    textRecordKey: "com.releasekey.encryptionPubKey",
    privateKeyEnvVar: "RECIPIENT_DEMO_PRIVATE_KEY",
  },
  {
    id: "carol",
    label: "Carol (the doctor)",
    ensName: "releasekey.eth",
    textRecordKey: "com.releasekey.encryptionPubKey.carol",
    privateKeyEnvVar: "RECIPIENT_DEMO_PRIVATE_KEY_CAROL",
  },
];

export function getDoctor(id: string): Doctor | undefined {
  return DOCTORS.find((d) => d.id === id);
}
