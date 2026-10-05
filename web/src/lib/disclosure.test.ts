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

  // Regression: the ID rule used to eat "0000-0000 1990" out of the phone number
  // and the birth year, leaving "090-" and "1月1日生" visible on screen.
  it("removes a phone, a birth date and an insurance number from one Japanese sentence", () => {
    const input = "テスト太郎 090-0000-0000 1990年1月1日生 東京都千代田区1-1-1 保険証番号12345678";
    const r = redact(input);

    expect(r.redactedText).not.toMatch(/090|0000|1990|12345678/);
    expect(r.redactedText).toBe(
      "テスト太郎 [PHONE_1] [DATE_1]生 東京都千代田区1-1-1 保険証番号[ID_NUMBER_1]"
    );
    expect(r.summary).toMatchObject({ PHONE: 1, DATE: 1, ID_NUMBER: 1 });
  });

  it("removes Japanese landline and mobile numbers with hyphens", () => {
    const r = redact("03-0000-0000 と 090-0000-0000 と 0120-12-3456");
    expect(r.summary.PHONE).toBe(3);
    expect(r.redactedText).not.toMatch(/0000|0120|-12-/);
  });

  it("removes Japanese dates in the Western and era (和暦) forms", () => {
    const r = redact("1990年1月1日生まれ、平成5年3月4日に入院");
    expect(r.summary.DATE).toBe(2);
    expect(r.redactedText).not.toMatch(/1990|平成5/);
  });

  it("replaces only the number after a My Number or insurance label, and keeps the label", () => {
    const r = redact("マイナンバー: 1234-5678-9012 / 個人番号は123456789012");
    expect(r.redactedText).toBe("マイナンバー: [ID_NUMBER_1] / 個人番号は[ID_NUMBER_2]");
    expect(r.summary.ID_NUMBER).toBe(2);
  });

  it("numbers placeholders per category across rules, so different values never share one", () => {
    const r = redact("保険証番号12345678 and also 1234 5678 9012");
    expect(r.redactedText).toBe("保険証番号[ID_NUMBER_1] and also [ID_NUMBER_2]");
    expect(r.summary.ID_NUMBER).toBe(2);
  });
});
