import type { Hex } from "viem";
import { RevokeButton } from "./revoke-button";
import { AccessReportButton } from "./access-report-button";
import { ViewStoredButton } from "./view-stored-button";
import { BookFollowupButton } from "./book-followup-button";
import { AuditTrail } from "./audit-trail";
import { DENY_REASON_TEXT, type DenyReason } from "@/lib/release-decision";
import { getStoredRecord } from "@/lib/record-store";
import { getDoctor } from "@/lib/doctors";
import { threadStore } from "@/lib/thread-store";
import { originEligibility } from "@/lib/origin-eligibility";

type SearchParams = Promise<{ status?: string; reason?: string; recordId?: string }>;

// Renders both the success path and every failure path (denied, cancelled,
// expired, tampered, internal error) with the reason visible — SPEC.md §3
// requires the failure path to explain why nothing was released.
export default async function ReleaseResultPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { status, reason, recordId } = await searchParams;
  const approved = status === "approved";
  const stored = recordId ? getStoredRecord(recordId as Hex) : undefined;
  const doctor = stored ? getDoctor(stored.doctorId) : undefined;

  // A follow-up thread can start from any record with a final decision
  // (approved, revoked or refused), decided by the same rule as POST /api/threads.
  // A record that already has a thread links to it instead.
  const isFirstRecord = Boolean(recordId && stored && !stored.threadId);
  const existingThread = isFirstRecord ? threadStore.findByOrigin(recordId as Hex) : undefined;
  const canBook =
    isFirstRecord && !existingThread && stored
      ? (await originEligibility(recordId as Hex, stored)).ok
      : false;

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div
          className={`mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm ${
            approved
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${approved ? "bg-emerald-400" : "bg-red-400"}`} />
          {approved ? "Released" : "Not released"}
        </div>

        {approved ? (
          <>
            <p className="text-sm text-neutral-400">
              A fresh World ID verification was validated and{" "}
              <span className="text-neutral-200">approveRelease</span> was called on-chain.
              The release envelope expires shortly, by design.
            </p>
            {doctor && (
              <p className="mt-3 text-xs text-neutral-500">
                Released to: <span className="text-neutral-300">{doctor.label}</span>{" "}
                <span className="font-mono text-neutral-500">— {doctor.ensName}</span> — the
                content was encrypted to their ENS-published public key when it was
                prepared; only they can decrypt it.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-neutral-400">
            {reason && reason in DENY_REASON_TEXT && (
              <span className="mb-2 block text-neutral-200">{DENY_REASON_TEXT[reason as DenyReason]}</span>
            )}
            No approval was ever attempted on-chain.{" "}
            {reason && (
              <>
                Reason: <span className="font-mono text-neutral-300">{reason}</span>
              </>
            )}
          </p>
        )}

        {recordId && (
          <p className="mt-4 font-mono text-xs break-all text-neutral-600">{recordId}</p>
        )}

        {stored?.threadId && (
          <a
            href={`/thread/${stored.threadId}`}
            className="mt-4 inline-block text-sm text-neutral-300 underline underline-offset-4 hover:text-white"
          >
            This is a follow-up in a thread → back to the thread
          </a>
        )}
        {existingThread && (
          <a
            href={`/thread/${existingThread.threadId}`}
            className="mt-4 inline-block text-sm text-neutral-300 underline underline-offset-4 hover:text-white"
          >
            Open the follow-up thread →
          </a>
        )}
        {canBook && recordId && <BookFollowupButton recordId={recordId} />}
        {recordId && stored?.encryptedContent && <ViewStoredButton recordId={recordId} />}
        {approved && recordId && <AccessReportButton recordId={recordId} />}
        {approved && recordId && <RevokeButton recordId={recordId} />}
        {recordId && <AuditTrail recordId={recordId} />}

        <a
          href="/release"
          className="mt-8 inline-block text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-300"
        >
          Back
        </a>
      </div>
    </main>
  );
}
