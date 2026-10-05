// Demo recipient directory. Both doctors' public keys live as text
// records on the same ENS name (releasekey.eth) — see ENS-FEEDBACK.md for
// why per-recipient subnames weren't used tonight (unverified ENSv2
// write interface risk). This file is the single source of truth for
// which text-record key belongs to which doctor, used by both the client
// (to render the picker) and the server (to know what to look up).
//
// Phase 1.5 (SPEC-v2 §3): every doctor also has a coarse area and a
// rating so they can be searched. ALL doctors, names, areas, ratings and
// review counts here are SYNTHETIC demo data — not real people, not real
// reviews. Only doctors with a published encryption key (`DOCTORS`) can
// receive a release; the others are listed for search but cannot be
// selected, and `getDoctor()` does not resolve them, so the decision
// router denies them as `unknown_recipient`.

/** Coarse location only (prefecture and city). No coordinates, ever. */
export type DoctorArea = { prefecture: string; city: string };

export type DoctorProfile = {
  id: string;
  label: string;
  area: DoctorArea;
  /** SYNTHETIC demo rating, 1.0–5.0. Not a real review score. */
  rating: number;
  /** SYNTHETIC demo count. Not a real review count. */
  reviewCount: number;
  /** A release can only be addressed to a doctor with a published key. */
  hasEncryptionKey: boolean;
};

export type Doctor = DoctorProfile & {
  hasEncryptionKey: true;
  ensName: string;
  textRecordKey: string;
  /** Env var holding this doctor's private key — demo-only, see
   * README's Known limitations (real decryption must happen on the
   * recipient's own client, never server-side like this). */
  privateKeyEnvVar: string;
};

/** Doctors with a published key. The only ones a release can go to. */
export const DOCTORS: Doctor[] = [
  {
    id: "bob",
    label: "Bob (the doctor)",
    area: { prefecture: "東京都", city: "千代田区" },
    rating: 4.6,
    reviewCount: 38,
    hasEncryptionKey: true,
    ensName: "releasekey.eth",
    textRecordKey: "com.releasekey.encryptionPubKey",
    privateKeyEnvVar: "RECIPIENT_DEMO_PRIVATE_KEY",
  },
  {
    id: "carol",
    label: "Carol (the doctor)",
    area: { prefecture: "大阪府", city: "大阪市北区" },
    rating: 4.2,
    reviewCount: 21,
    hasEncryptionKey: true,
    ensName: "releasekey.eth",
    textRecordKey: "com.releasekey.encryptionPubKey.carol",
    privateKeyEnvVar: "RECIPIENT_DEMO_PRIVATE_KEY_CAROL",
  },
];

/** Listed for search only. No published key, so they cannot be selected. */
export const UNKEYED_DOCTORS: DoctorProfile[] = [
  {
    id: "dana",
    label: "Dana (the doctor, demo)",
    area: { prefecture: "北海道", city: "札幌市中央区" },
    rating: 3.8,
    reviewCount: 12,
    hasEncryptionKey: false,
  },
  {
    id: "erin",
    label: "Erin (the doctor, demo)",
    area: { prefecture: "福岡県", city: "福岡市博多区" },
    rating: 4.9,
    reviewCount: 57,
    hasEncryptionKey: false,
  },
  {
    id: "frank",
    label: "Frank (the doctor, demo)",
    area: { prefecture: "東京都", city: "世田谷区" },
    rating: 4.1,
    reviewCount: 9,
    hasEncryptionKey: false,
  },
  {
    id: "gina",
    label: "Gina (the doctor, demo)",
    area: { prefecture: "大阪府", city: "大阪市北区" },
    rating: 2.9,
    reviewCount: 6,
    hasEncryptionKey: false,
  },
];

/** Everything the search page lists: bookable and not-yet-bookable doctors. */
export const DOCTOR_PROFILES: DoctorProfile[] = [...DOCTORS, ...UNKEYED_DOCTORS];

/** Resolves only doctors with a published key. Unlisted or unkeyed ids → undefined. */
export function getDoctor(id: string): Doctor | undefined {
  return DOCTORS.find((d) => d.id === id);
}
