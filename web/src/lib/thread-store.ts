// Follow-up threads (SPEC-v2 §3, Phase 1.5 part 2).
//
// A thread is only a grouping: it links a doctor to the records shared in a
// follow-up conversation. It carries NO approval, NO approvedUntil, NO TTL and
// NO auto-release. Each record in a thread is a separate record with its own
// fresh human approval (World ID), so opening a thread never shares anything.
//
// The doctor's replies are a fixed menu of codes, never free text, so no new
// unredacted data path is created. Events hold codes and record ids only.
//
// DEMO-GRADE: one in-memory store per server process, like the other stores.
// The threadId is a bearer capability, like recordId (README, Known limitations).

import type { Hex } from "viem";

export type ThreadEvent =
  | { kind: "opened"; at: number }
  | { kind: "doctor_reply"; code: DoctorReplyCode; at: number }
  | { kind: "record_prepared"; recordId: Hex; sequence: number; at: number }
  | { kind: "record_denied"; recordId: Hex; at: number };

/** Fixed menu the doctor can reply with. No free text. */
export const DOCTOR_REPLY_CODES = ["request_followup_record", "confirm_received"] as const;
export type DoctorReplyCode = (typeof DOCTOR_REPLY_CODES)[number];

export type Thread = {
  threadId: Hex;
  doctorId: string;
  /** The record the follow-up was booked from. */
  originRecordId: Hex;
  status: "open" | "closed";
  /** Follow-up records, in the order they were prepared. Origin excluded. */
  recordIds: Hex[];
  events: ThreadEvent[];
  createdAt: number;
};

export class ThreadStore {
  private readonly threads = new Map<Hex, Thread>();

  open(threadId: Hex, doctorId: string, originRecordId: Hex, now = Date.now()): Thread {
    const thread: Thread = {
      threadId,
      doctorId,
      originRecordId,
      status: "open",
      recordIds: [],
      events: [{ kind: "opened", at: now }],
      createdAt: now,
    };
    this.threads.set(threadId, thread);
    return copy(thread);
  }

  /** Copy of the thread, or undefined if unknown. */
  get(threadId: Hex): Thread | undefined {
    const thread = this.threads.get(threadId);
    return thread && copy(thread);
  }

  /** The thread already opened from this record, if any (one per origin). */
  findByOrigin(originRecordId: Hex): Thread | undefined {
    for (const thread of this.threads.values()) {
      if (thread.originRecordId === originRecordId) return copy(thread);
    }
    return undefined;
  }

  /** Records a follow-up record. Returns its 1-based sequence number. */
  attachRecord(threadId: Hex, recordId: Hex, now = Date.now()): number {
    const thread = this.mustOpen(threadId);
    thread.recordIds.push(recordId);
    const sequence = thread.recordIds.length;
    thread.events.push({ kind: "record_prepared", recordId, sequence, at: now });
    return sequence;
  }

  /** Records a refused follow-up. The thread stays open. */
  recordDenied(threadId: Hex, recordId: Hex, now = Date.now()): void {
    this.mustOpen(threadId).events.push({ kind: "record_denied", recordId, at: now });
  }

  addDoctorReply(threadId: Hex, code: DoctorReplyCode, now = Date.now()): void {
    this.mustOpen(threadId).events.push({ kind: "doctor_reply", code, at: now });
  }

  close(threadId: Hex): void {
    const thread = this.threads.get(threadId);
    if (thread) thread.status = "closed";
  }

  private mustOpen(threadId: Hex): Thread {
    const thread = this.threads.get(threadId);
    if (!thread) throw new ThreadError("thread_not_found");
    if (thread.status !== "open") throw new ThreadError("thread_closed");
    return thread;
  }
}

export class ThreadError extends Error {
  constructor(public readonly reason: "thread_not_found" | "thread_closed") {
    super(reason);
  }
}

function copy(thread: Thread): Thread {
  return {
    ...thread,
    recordIds: [...thread.recordIds],
    events: thread.events.map((e) => ({ ...e })),
  };
}

// One store per server process, used by the API routes and the thread page.
export const threadStore = new ThreadStore();
