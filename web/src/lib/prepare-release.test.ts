import { describe, expect, it, vi } from "vitest";
import type { Hex } from "viem";
import { DOCTORS } from "./doctors";
import { DEFAULT_POLICY, type ConsentPolicy } from "./consent-policy";
import { prepareRelease, type PrepareDeps } from "./prepare-release";

const BOB = DOCTORS.find((d) => d.id === "bob")!;
const CAROL = DOCTORS.find((d) => d.id === "carol")!;
const PUBLIC_KEY = ("0x" + "ab".repeat(33)) as Hex;

// Fake deps: no chain, no ENS, no env vars. Every side effect is a spy.
function makeDeps(policy: ConsentPolicy = DEFAULT_POLICY) {
  let counter = 0;
  const audit: { recordId: string; type: string; details?: Record<string, unknown> }[] = [];
  const deps = {
    randomId: vi.fn(() => (`0x${(++counter).toString(16).padStart(64, "0")}`) as Hex),
    loadPolicy: vi.fn(async () => policy),
    getRecipientPublicKey: vi.fn(async () => PUBLIC_KEY),
    // Fake ciphertext = hex of the plaintext it was given, so tests can see what was encrypted.
    encrypt: vi.fn((text: string, publicKey: Hex) => ({
      ephemeralPublicKey: publicKey,
      iv: "0x02",
      ciphertext: `0x${Buffer.from(text).toString("hex")}` as Hex,
    })),
    createCommitment: vi.fn(async () => ("0x" + "cd".repeat(32)) as Hex),
    storeRecord: vi.fn(),
    storeRefusal: vi.fn(),
    audit: {
      append: vi.fn((recordId: string, type: string, opts?: { details?: Record<string, unknown> }) => {
        audit.push({ recordId, type, details: opts?.details });
      }),
    },
  };
  return { deps: deps as PrepareDeps & typeof deps, audit };
}

const CLEAN_TEXT = "Routine check-in. Sleep was fine and appetite is steady this week.";

describe("prepareRelease", () => {
  it("refuses before the chain when the policy does not allow the recipient", async () => {
    const { deps, audit } = makeDeps({ ...DEFAULT_POLICY, allowedRecipients: ["bob"] });
    const result = await prepareRelease(
      { doctorId: "carol", doctor: CAROL, content: CLEAN_TEXT },
      deps
    );

    expect(result.outcome).toBe("denied");
    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ error: "policy_denied", reason: "recipient_not_allowed" });
    expect(deps.createCommitment).not.toHaveBeenCalled();
    expect(deps.storeRecord).not.toHaveBeenCalled();
    expect(audit.map((a) => a.type)).toEqual(["redacted", "policy_denied"]);
  });

  it("keeps a refusal with its reason but no content, so it can be the origin of a follow-up", async () => {
    const { deps } = makeDeps({ ...DEFAULT_POLICY, allowedRecipients: ["bob"] });
    const result = await prepareRelease({ doctorId: "carol", doctor: CAROL, content: CLEAN_TEXT }, deps);
    expect(deps.storeRefusal).toHaveBeenCalledTimes(1);
    expect(deps.storeRefusal).toHaveBeenCalledWith(result.recordId, {
      recipientEns: CAROL.ensName,
      doctorId: "carol",
      reason: "recipient_not_allowed",
    });
    expect(deps.encrypt).not.toHaveBeenCalled();
  });

  it("keeps nothing for an unknown recipient, since there is no doctor to book with", async () => {
    const { deps } = makeDeps();
    await prepareRelease({ doctorId: "nobody", doctor: undefined, content: CLEAN_TEXT }, deps);
    expect(deps.storeRefusal).not.toHaveBeenCalled();
  });

  it("refuses an unknown recipient before the chain", async () => {
    const { deps } = makeDeps();
    const result = await prepareRelease({ doctorId: "nobody", doctor: undefined, content: CLEAN_TEXT }, deps);
    expect(result.body).toMatchObject({ reason: "unknown_recipient" });
    expect(deps.createCommitment).not.toHaveBeenCalled();
  });

  it("prepares a record that still needs a human approval, with one commitment and a fresh recordId", async () => {
    const { deps, audit } = makeDeps();
    const first = await prepareRelease({ doctorId: "bob", doctor: BOB, content: CLEAN_TEXT }, deps);
    const second = await prepareRelease({ doctorId: "bob", doctor: BOB, content: CLEAN_TEXT }, deps);

    expect(first.outcome).toBe("prepared");
    expect(first.status).toBe(200);
    expect(first.body.decision).toMatchObject({ outcome: "require_human" });
    expect(deps.createCommitment).toHaveBeenCalledTimes(2);
    expect(first.recordId).not.toBe(second.recordId);
    expect(audit.filter((a) => a.type === "prepared").map((a) => a.recordId)).toEqual([first.recordId, second.recordId]);
  });

  it("never produces an approval: the prepared result is only require_human", async () => {
    const { deps } = makeDeps();
    const result = await prepareRelease({ doctorId: "bob", doctor: BOB, content: CLEAN_TEXT }, deps);
    expect(result.body.decision).not.toMatchObject({ outcome: "approved" });
    expect(Object.keys(deps)).not.toContain("approveRelease");
  });

  it("stamps threadId on every audit entry of a follow-up, and not on a plain record", async () => {
    const { deps, audit } = makeDeps();
    await prepareRelease({ doctorId: "bob", doctor: BOB, content: CLEAN_TEXT, threadId: "0xthread" }, deps);
    expect(audit.length).toBeGreaterThan(0);
    for (const entry of audit) expect(entry.details).toMatchObject({ threadId: "0xthread" });

    const plain = makeDeps();
    await prepareRelease({ doctorId: "bob", doctor: BOB, content: CLEAN_TEXT }, plain.deps);
    for (const entry of plain.audit) expect(entry.details?.threadId).toBeUndefined();
  });

  it("applies the same redaction to a follow-up: an identifier never reaches the encrypted text", async () => {
    const { deps } = makeDeps();
    const result = await prepareRelease(
      { doctorId: "bob", doctor: BOB, content: "Call me at 090-1234-5678 about the follow-up.", threadId: "0xthread" },
      deps
    );
    expect(result.outcome).toBe("prepared");
    expect(result.body.disclosure).toMatchObject({ totalRedacted: 1 });
    const encryptedText = deps.encrypt.mock.calls[0][0];
    expect(encryptedText).not.toContain("090-1234-5678");
    expect(encryptedText).toContain("[PHONE_1]");
  });

  it("reports a failed commitment without marking the record as approved", async () => {
    const { deps } = makeDeps();
    deps.createCommitment.mockRejectedValueOnce(new Error("rpc down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await prepareRelease({ doctorId: "bob", doctor: BOB, content: CLEAN_TEXT }, deps);
    errorSpy.mockRestore();
    expect(result.outcome).toBe("failed");
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ error: "create_commitment_failed" });
  });
});
