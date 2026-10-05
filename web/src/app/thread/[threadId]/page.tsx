import Link from "next/link";
import { isHex, type Hex } from "viem";
import { getRecord } from "@/lib/chain";
import { getDoctor } from "@/lib/doctors";
import { threadStore, type ThreadEvent } from "@/lib/thread-store";
import { auditLog, verifyChain } from "@/lib/audit-log";
import { FollowupComposer, DoctorReplyButtons } from "./thread-actions";

// Phase 1.5 part 2: the asynchronous thread. Every follow-up is its own record
// and needs its own fresh human approval. Nothing here approves anything.
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ threadId: string }> };

const STATUS_LABELS = ["None", "Created", "Approved", "Revoked"] as const;

function eventLabel(e: ThreadEvent): string {
  switch (e.kind) {
    case "opened":
      return "Follow-up booked by the doctor";
    case "doctor_reply":
      return `Doctor replied: ${e.code}`;
    case "record_prepared":
      return `Follow-up record #${e.sequence} prepared (awaiting a fresh approval)`;
    case "record_denied":
      return "Follow-up refused before the chain. Nothing was shared.";
  }
}

async function recordStatus(recordId: Hex): Promise<string> {
  try {
    const record = await getRecord(recordId);
    return STATUS_LABELS[record.status] ?? "Unknown";
  } catch {
    return "unavailable";
  }
}

export default async function ThreadPage({ params }: PageProps) {
  const { threadId } = await params;
  if (!isHex(threadId, { strict: true }) || threadId.length !== 66) {
    return <p className="p-10 text-sm text-red-300">Invalid thread id.</p>;
  }
  const thread = threadStore.get(threadId as Hex);
  if (!thread) {
    return <p className="p-10 text-sm text-red-300">Thread not found.</p>;
  }

  const doctor = getDoctor(thread.doctorId);
  const followups = await Promise.all(
    thread.recordIds.map(async (recordId) => ({ recordId, status: await recordStatus(recordId) }))
  );
  const auditEntries = auditLog.entriesForThread(threadId);
  const chain = verifyChain(auditLog.entries());

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <p className="text-xs uppercase tracking-wide text-neutral-500">RELEASEKEY · THREAD</p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-100">
          {doctor?.label ?? "Doctor"} — follow-up
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          This thread shares nothing by itself. Each follow-up record below is released only after
          its own fresh World ID approval, and a refused one is shown here too.
        </p>
        <p className="mt-3 font-mono text-xs break-all text-neutral-600">{threadId}</p>

        <section className="mt-8">
          <h2 className="text-sm font-medium text-neutral-300">Thread</h2>
          <ol className="mt-3 space-y-2 border-l border-neutral-800 pl-4">
            {thread.events.map((e, i) => (
              <li key={i} className="text-sm text-neutral-300">
                {eventLabel(e)}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-medium text-neutral-300">Follow-up records</h2>
          {followups.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No follow-up record yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {followups.map(({ recordId, status }, i) => (
                <li
                  key={recordId}
                  className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-neutral-200">Follow-up #{i + 1}</span>
                    <span className="font-mono text-xs text-neutral-400">{status}</span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] break-all text-neutral-600">{recordId}</p>
                  <div className="mt-2 flex gap-4 text-xs">
                    {status === "Created" && (
                      <a
                        href={`/api/world/authorize?recordId=${recordId}`}
                        className="text-neutral-200 underline underline-offset-4 hover:text-white"
                      >
                        Approve this record (fresh World ID) →
                      </a>
                    )}
                    <a
                      href={`/api/records/${recordId}`}
                      className="text-neutral-500 underline underline-offset-4 hover:text-neutral-300"
                    >
                      On-chain status (JSON)
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {thread.status === "open" && (
          <section className="mt-8 space-y-6">
            <DoctorReplyButtons threadId={threadId} />
            <FollowupComposer threadId={threadId} />
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-sm font-medium text-neutral-300">Audit trail for this thread</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Chain {chain.ok ? "verifies ✓" : `BROKEN at entry ${"brokenAt" in chain ? chain.brokenAt : "?"}`} ·
            codes and counts only, no content
          </p>
          <ul className="mt-3 space-y-1 font-mono text-xs text-neutral-400">
            {auditEntries.map((e) => (
              <li key={e.index}>
                #{e.index} {e.type}
                {e.reason ? ` · ${e.reason}` : ""}
              </li>
            ))}
          </ul>
        </section>

        <Link
          href="/doctors"
          className="mt-10 inline-block text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-300"
        >
          ← Find a doctor
        </Link>
      </div>
    </main>
  );
}
