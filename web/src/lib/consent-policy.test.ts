import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, parsePolicy } from "./consent-policy";

describe("parsePolicy (fail-closed)", () => {
  it("returns the strict default when nothing is set", () => {
    expect(parsePolicy({})).toEqual(DEFAULT_POLICY);
  });

  it("parses valid values and marks the source as ens", () => {
    const p = parsePolicy({
      maxTtlSeconds: "300",
      maxReidRisk: "25",
      disclosure: "full",
      allowedRecipients: "bob",
    });
    expect(p).toEqual({
      maxTtlSeconds: 300,
      maxReidRisk: 25,
      disclosure: "full",
      allowedRecipients: ["bob"],
      source: "ens",
    });
  });

  it("falls back per field on garbage or out-of-range values", () => {
    const p = parsePolicy({
      maxTtlSeconds: "999999", // above the contract's 1h cap
      maxReidRisk: "-5",
      disclosure: "everything",
      allowedRecipients: " , ;drop table",
    });
    expect(p.maxTtlSeconds).toBe(DEFAULT_POLICY.maxTtlSeconds);
    expect(p.maxReidRisk).toBe(DEFAULT_POLICY.maxReidRisk);
    expect(p.disclosure).toBe("redacted");
    expect(p.allowedRecipients).toEqual(DEFAULT_POLICY.allowedRecipients);
    expect(p.source).toBe("default");
  });

  it("never allows a TTL above the on-chain maximum", () => {
    expect(parsePolicy({ maxTtlSeconds: "3601" }).maxTtlSeconds).toBe(DEFAULT_POLICY.maxTtlSeconds);
    expect(parsePolicy({ maxTtlSeconds: "3600" }).maxTtlSeconds).toBe(3600);
  });
});
