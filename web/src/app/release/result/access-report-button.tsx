"use client";

import { useState } from "react";
import { getDoctor } from "@/lib/doctors";

// Demo-only "view as the recipient" button — see api/records/[recordId]/content
// for why decryption happens server-side here. Gated on isReleasable(recordId),
// same check a real third-party /access endpoint should use. Revoking (or
// letting the TTL expire) makes this fail immediately, even though nothing
// about the button itself changed.
export function AccessReportButton({ recordId }: { recordId: string }) {
  const [state, setState] = useState<"idle" | "pending" | "granted" | "denied">("idle");
  const [content, setContent] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState<string | null>(null);
  const [viewedAt, setViewedAt] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState(false);

  const doctor = doctorId ? getDoctor(doctorId) : undefined;
  const doctorLabel = doctor?.label ?? "the recipient";

  const access = async () => {
    setState("pending");
    try {
      const res = await fetch(`/api/records/${recordId}/content`);
      const body = await res.json();
      if (!res.ok) {
        setDenyReason(body.message ?? body.error ?? "access denied");
        setState("denied");
        return;
      }
      setContent(body.content);
      setDoctorId(body.doctorId ?? null);
      setViewedAt(new Date().toLocaleString());
      setState("granted");
    } catch {
      setDenyReason("network error");
      setState("denied");
    }
  };

  if (state === "granted" && content) {
    return (
      <div className="mt-6 w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-6 py-4 text-left">
        <p className="mb-2 text-xs uppercase tracking-wide text-emerald-400">
          {doctorLabel} opens the report
        </p>
        <p className="text-sm text-neutral-200">{content}</p>
        <p className="mt-3 text-xs text-neutral-500">
          {doctorLabel} can now follow up with Alice — but only because she approved this,
          right now, in person. The agent never had the power to decide that on its own.
        </p>
        <p className="mt-2 text-[10px] text-neutral-600">
          Viewed by {doctorLabel} at {viewedAt}
        </p>

        {followUp ? (
          <p className="mt-4 text-xs text-emerald-300">
            ✓ Follow-up with Alice scheduled (demo only).
          </p>
        ) : (
          <button
            onClick={() => setFollowUp(true)}
            className="mt-4 w-full rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
          >
            Schedule follow-up with Alice
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <button
        onClick={access}
        disabled={state === "pending"}
        className="rounded-full border border-neutral-700 bg-neutral-900 px-6 py-2 text-xs font-medium text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-60"
      >
        {state === "pending" ? "Checking…" : "View report (as recipient)"}
      </button>
      {state === "denied" && (
        <p className="max-w-xs text-xs text-red-400">Access denied: {denyReason}</p>
      )}
    </div>
  );
}
