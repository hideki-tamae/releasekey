// Loads the data subject's consent policy from ENS text records
// (SPEC-v2 §3.3). The agent only ever READS these records; with ENSv2
// Enhanced Access Control (Phase 2) it cannot write them either.
//
// Which name to read is configured server-side (POLICY_ENS_NAME) — never
// taken from client input. If it is unset, or any lookup fails, the strict
// DEFAULT_POLICY is used (fail closed).
import "server-only";
import { publicClient } from "./chain";
import { DEFAULT_POLICY, POLICY_KEYS, parsePolicy, type ConsentPolicy } from "./consent-policy";

export async function loadConsentPolicy(): Promise<ConsentPolicy> {
  const name = process.env.POLICY_ENS_NAME;
  if (!name) return DEFAULT_POLICY;

  try {
    const entries = await Promise.all(
      (Object.keys(POLICY_KEYS) as (keyof typeof POLICY_KEYS)[]).map(async (field) => {
        const value = await publicClient.getEnsText({ name, key: POLICY_KEYS[field] });
        return [field, value ?? undefined] as const;
      })
    );
    return parsePolicy(Object.fromEntries(entries));
  } catch (err) {
    console.error("loading consent policy from ENS failed, using strict default:", err);
    return DEFAULT_POLICY;
  }
}
