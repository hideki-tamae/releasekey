import { describe, expect, it } from "vitest";
import { redact } from "./disclosure";

describe("redact (minimal disclosure)", () => {
  it("leaves clean text unchanged", () => {
    const text = "I slept badly this week and felt tired at work.";
    const r = redact(text);
    expect(r.redactedText).toBe(text);
    expect(r.totalRedacted).toBe(0);
  });

  it("removes emails, URLs, JP and international phone numbers", () => {
    const r = redact(
      "Call me on 090-1234-5678 or +81 3 1234 5678, mail taro@example.jp, see https://example.com/me"
    );
    expect(r.redactedText).not.toMatch(/1234|taro@|example\.com/);
    expect(r.summary.PHONE).toBe(2);
    expect(r.summary.EMAIL).toBe(1);
    expect(r.summary.URL).toBe(1);
  });

  it("removes 12-digit ID numbers before the phone rule can split them", () => {
    const r = redact("My number is 1234 5678 9012.");
    expect(r.redactedText).toBe("My number is [ID_NUMBER_1].");
    expect(r.summary.PHONE).toBe(0);
  });

  it("removes dates in several formats and postal codes", () => {
    const r = redact("Born 1980年4月5日, visit on 2026-09-30 and 5/4/1980, 〒105-0001.");
    expect(r.summary.DATE).toBe(3);
    expect(r.summary.POSTAL_CODE).toBe(1);
    expect(r.redactedText).not.toMatch(/1980|2026|105-0001/);
  });

  it("uses the same placeholder for repeated values and numbers distinct ones", () => {
    const r = redact("09012345678, again 09012345678, and 08011112222");
    expect(r.redactedText).toBe("[PHONE_1], again [PHONE_1], and [PHONE_2]");
    expect(r.summary.PHONE).toBe(2);
  });

  it("never returns the original values anywhere in the result", () => {
    const r = redact("taro@example.jp 090-1234-5678");
    expect(JSON.stringify(r)).not.toMatch(/taro@example\.jp|090-1234-5678/);
  });
});
