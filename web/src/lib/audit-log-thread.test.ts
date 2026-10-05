import { describe, expect, it } from "vitest";
import { AuditLog, verifyChain } from "./audit-log";

// Phase 1.5 part 2: thread events live in the same hash chain as every other
// event. They must verify, filter by threadId, and break on tampering.
function threadSample() {
  const log = new AuditLog();
  log.append("0xorigin", "prepared", { at: 1, details: { ttlSeconds: 900 } });
  log.append("0xorigin", "thread_opened", { at: 2, details: { threadId: "0xthread" } });
  log.append("0xfollow1", "redacted", { at: 3, details: { totalRedacted: 1, riskScore: 0, threadId: "0xthread" } });
  log.append("0xfollow1", "prepared", { at: 4, details: { ttlSeconds: 900, threadId: "0xthread" } });
  log.append("0xorigin", "thread_reply", { at: 5, details: { threadId: "0xthread", reply: "confirm_received" } });
  log.append("0xfollow2", "policy_denied", { at: 6, reason: "reidentification_risk_too_high", details: { rule: 5, threadId: "0xthread" } });
  log.append("0xother", "prepared", { at: 7, details: { ttlSeconds: 900 } });
  return log;
}

describe("AuditLog thread events", () => {
  it("verifies a chain that contains thread events", () => {
    expect(verifyChain(threadSample().entries())).toEqual({ ok: true });
  });

  it("returns only this thread's entries, in order", () => {
    const entries = threadSample().entriesForThread("0xthread");
    expect(entries.map((e) => e.type)).toEqual([
      "thread_opened",
      "redacted",
      "prepared",
      "thread_reply",
      "policy_denied",
    ]);
    expect(entries.every((e) => e.details?.threadId === "0xthread")).toBe(true);
  });

  it("returns nothing for an unknown thread", () => {
    expect(threadSample().entriesForThread("0xnope")).toEqual([]);
  });

  it("detects a tampered threadId in a thread entry", () => {
    const entries = threadSample().entries();
    entries[2] = { ...entries[2], details: { totalRedacted: 1, riskScore: 0, threadId: "0xforged" } };
    expect(verifyChain(entries)).toEqual({ ok: false, brokenAt: 2 });
  });

  it("detects a removed thread entry", () => {
    const entries = threadSample().entries();
    entries.splice(4, 1);
    expect(verifyChain(entries.map((e, i) => ({ ...e, index: i })))).toEqual({ ok: false, brokenAt: 4 });
  });

  it("still refuses content-like keys inside thread details", () => {
    const log = new AuditLog();
    expect(() => log.append("0xt", "thread_reply", { details: { threadId: "0x1", text: "hi" } })).toThrow(/text/);
  });
});
