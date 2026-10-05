// Production wiring for prepare-release.ts. This is the only place the prepare
// pipeline touches the chain, ENS, the encryption library and the in-memory
// stores. Keep it free of logic: the decisions live in prepare-release.ts.

import { randomBytes } from "crypto";
import type { Hex } from "viem";
import { createCommitment } from "./chain";
import { getRecipientPublicKey } from "./ens-encryption";
import { encryptForRecipient } from "./ens-crypto";
import { storeRecord, storeRefusal } from "./record-store";
import { loadConsentPolicy } from "./ens-policy";
import { auditLog } from "./audit-log";
import type { PrepareDeps } from "./prepare-release";

export const productionPrepareDeps: PrepareDeps = {
  randomId: () => `0x${randomBytes(32).toString("hex")}` as Hex,
  loadPolicy: loadConsentPolicy,
  getRecipientPublicKey,
  encrypt: encryptForRecipient,
  createCommitment,
  storeRecord,
  storeRefusal,
  audit: auditLog,
};
