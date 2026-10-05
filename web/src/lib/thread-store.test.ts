import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { DOCTOR_REPLY_CODES, ThreadError, ThreadStore } from "./thread-store";

const T = ("0x" + "11".repeat(32)) as Hex;
const ORIGIN = ("0x" + "22".repeat(32)) as Hex;
const R1 = ("0x" + "33".repeat(32)) as Hex;
const R2 = ("0x" + "44".repeat(32)) as Hex;
const R3 = ("0x" + "55".repeat(32)) as Hex;

describe("ThreadStore", () => {
  it("opens a thread linked to a doctor and an origin record, with no approval fields", () => {
    const store = new ThreadStore();
    const thread = store.open(T, "bob", ORIGIN, 100);

    expect(thread).toMatchObject({ threadId: T, doctorId: "bob", originRecordId: ORIGIN, status: "open", recordIds: [] });
    expect(thread.events).toEqual([{ kind: "opened", at: 100 }]);

    // A thread can never carry an approval, a TTL or an auto-release.
    for (const forbidden of ["approved", "approvedUntil", "ttlSeconds", "autoRelease"]) {
      expect(Object.keys(thread)).not.toContain(forbidden);
    }
  });

  it("finds the thread opened from an origin record", () => {
    const store = new ThreadStore();
    store.open(T, "bob", ORIGIN);
    expect(store.findByOrigin(ORIGIN)?.threadId).toBe(T);
    expect(store.findByOrigin(R1)).toBeUndefined();
  });

  it("numbers follow-up records in the order they are attached", () => {
    const store = new ThreadStore();
    store.open(T, "bob", ORIGIN);
    expect(store.attachRecord(T, R1)).toBe(1);
    expect(store.attachRecord(T, R2)).toBe(2);
    expect(store.get(T)?.recordIds).toEqual([R1, R2]);
  });

  it("records a refusal in the thread without attaching a record and keeps the thread open", () => {
    const store = new ThreadStore();
    store.open(T, "bob", ORIGIN);
    store.recordDenied(T, R3);
    const thread = store.get(T)!;
    expect(thread.status).toBe("open");
    expect(thread.recordIds).toEqual([]);
    expect(thread.events.at(-1)).toMatchObject({ kind: "record_denied", recordId: R3 });
  });

  it("accepts only fixed-menu doctor replies", () => {
    expect(DOCTOR_REPLY_CODES).toEqual(["request_followup_record", "confirm_received"]);
    const store = new ThreadStore();
    store.open(T, "bob", ORIGIN);
    store.addDoctorReply(T, "confirm_received");
    expect(store.get(T)?.events.at(-1)).toMatchObject({ kind: "doctor_reply", code: "confirm_received" });
  });

  it("refuses new records on a closed thread", () => {
    const store = new ThreadStore();
    store.open(T, "bob", ORIGIN);
    store.close(T);
    expect(() => store.attachRecord(T, R1)).toThrow(ThreadError);
    expect(() => store.addDoctorReply(T, "confirm_received")).toThrow(ThreadError);
    try {
      store.attachRecord(T, R1);
    } catch (err) {
      expect((err as ThreadError).reason).toBe("thread_closed");
    }
  });

  it("returns undefined for an unknown thread and refuses to attach to it", () => {
    const store = new ThreadStore();
    expect(store.get(T)).toBeUndefined();
    expect(() => store.attachRecord(T, R1)).toThrow(ThreadError);
  });

  it("returns copies, so callers cannot change the stored thread", () => {
    const store = new ThreadStore();
    store.open(T, "bob", ORIGIN);
    const copy = store.get(T)!;
    copy.recordIds.push(R1);
    copy.status = "closed";
    expect(store.get(T)?.recordIds).toEqual([]);
    expect(store.get(T)?.status).toBe("open");
  });
});
