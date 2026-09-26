import { RevokeButton } from "./revoke-button";
import { AccessReportButton } from "./access-report-button";
import { ViewStoredButton } from "./view-stored-button";

// Fixed for this demo — see release-flow-client.tsx. The recipient's
// encryption key came from this same ENS name (com.releasekey.encryptionPubKey).
const RECIPIENT_ENS = "releasekey.eth";

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
            <p className="mt-3 text-xs text-neutral-500">
              Released to: <span className="text-neutral-300">Bob (the doctor)</span>{" "}
              <span className="font-mono text-neutral-500">— {RECIPIENT_ENS}</span> — the
              content was encrypted to Bob&apos;s ENS-published public key when it was
              prepared; only he can decrypt it.
            </p>
          </>
        ) : (
          <p className="text-sm text-neutral-400">
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

        {recordId && <ViewStoredButton recordId={recordId} />}
        {approved && recordId && <AccessReportButton recordId={recordId} />}
        {approved && recordId && <RevokeButton recordId={recordId} />}

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
