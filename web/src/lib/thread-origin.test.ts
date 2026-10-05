import { describe, expect, it } from "vitest";
import { checkThreadOrigin } from "./thread-origin";

describe("checkThreadOrigin", () => {
  it("allows an approved record", () => {
    expect(checkThreadOrigin({ refused: false, chainStatus: "Approved" })).toEqual({ ok: true });
  });

  it("allows a revoked record", () => {
    expect(checkThreadOrigin({ refused: false, chainStatus: "Revoked" })).toEqual({ ok: true });
  });

  it("allows a refused record, whatever the chain says", () => {
    expect(checkThreadOrigin({ refused: true, chainStatus: "None" })).toEqual({ ok: true });
  });

  it("refuses a record still awaiting approval (Created)", () => {
    expect(checkThreadOrigin({ refused: false, chainStatus: "Created" })).toEqual({
      ok: false,
      reason: "record_awaiting_approval",
    });
  });

  it("refuses a record that never reached the chain, or whose status cannot be read", () => {
    expect(checkThreadOrigin({ refused: false, chainStatus: "None" })).toEqual({ ok: false, reason: "record_not_decided" });
    expect(checkThreadOrigin({ refused: false, chainStatus: "unavailable" })).toEqual({
      ok: false,
      reason: "record_not_decided",
    });
  });
});
