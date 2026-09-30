import { describe, expect, it } from "vitest";
import { AuditLog, GENESIS_HASH, verifyChain } from "./audit-log";

function sample() {
  const log = new AuditLog();
  log.append("0xa", "prepared", { at: 1 });
  log.append("0xa", "redacted", { details: { totalRedacted: 2, riskScore: 12 }, at: 2 });
  log.append("0xb", "policy_denied", { reason: "reidentification_risk_too_high", at: 3 });
  log.append("0xa", "approved", { details: { ttlSeconds: 900 }, at: 4 });
  return log;
}

describe("AuditLog (hash chain)", () => {
  it("links each entry to the previous one and verifies", () => {
    const entries = sample().entries();
    expect(entries[0].prevHash).toBe(GENESIS_HASH);
    expect(entries[1].prevHash).toBe(entries[0].hash);
    expect(verifyChain(entries)).toEqual({ ok: true });
  });

  it("detects an edited field", () => {
    const entries = sample().entries();
    entries[2] = { ...entries[2], reason: "approved_anyway" };
    expect(verifyChain(entries)).toEqual({ ok: false, brokenAt: 2 });
  });

  it("detects an edited detail value", () => {
    const entries = sample().entries();
    entries[3] = { ...entries[3], details: { ttlSeconds: 3600 } };
    expect(verifyChain(entries)).toEqual({ ok: false, brokenAt: 3 });
  });

  it("detects a deleted entry", () => {
    const entries = sample().entries();
    entries.splice(1, 1);
    expect(verifyChain(entries).ok).toBe(false);
  });

  it("detects reordering", () => {
    const entries = sample().entries();
    [entries[1], entries[2]] = [entries[2], entries[1]];
    expect(verifyChain(entries).ok).toBe(false);
  });

  it("filters by record without mutating the log", () => {
    const log = sample();
    expect(log.entries("0xa").map((e) => e.type)).toEqual(["prepared", "redacted", "approved"]);
    log.entries()[0].type = "revoked";
    expect(log.entries()[0].type).toBe("prepared");
  });

  it("refuses content or personal data in details", () => {
    const log = new AuditLog();
    expect(() => log.append("0xa", "prepared", { details: { content: "secret" } })).toThrow();
    expect(() => log.append("0xa", "prepared", { details: { patientName: "x" } })).toThrow();
    expect(() => log.append("0xa", "prepared", { details: { salt: "0x1" } })).toThrow();
  });
});
