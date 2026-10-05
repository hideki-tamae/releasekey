"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DENY_REASON_TEXT, type DenyReason } from "@/lib/release-decision";

// Client-side actions on a thread. Both call the API and then refresh the
// page from the server. Neither one approves anything.

const REPLY_LABELS = {
  request_followup_record: "Ask for the next record",
  confirm_received: "Confirm received",
} as const;

export function DoctorReplyButtons({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const reply = async (code: keyof typeof REPLY_LABELS) => {
    setBusy(true);
    try {
      await fetch(`/api/threads/${threadId}/replies`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-neutral-300">Doctor replies (fixed menu, no free text)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(Object.keys(REPLY_LABELS) as (keyof typeof REPLY_LABELS)[]).map((code) => (
          <button
            key={code}
            disabled={busy}
            onClick={() => reply(code)}
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 hover:border-neutral-600 disabled:opacity-50"
          >
            {REPLY_LABELS[code]}
          </button>
        ))}
      </div>
    </div>
  );
}

type Outcome =
  | { kind: "prepared"; recordId: string; sequence: number }
  | { kind: "denied"; reason: string }
  | { kind: "error"; message: string };

export function FollowupComposer({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const prepare = async () => {
    setBusy(true);
    setOutcome(null);
    try {
      const res = await fetch(`/api/threads/${threadId}/records`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = await res.json();
      if (res.ok) {
        setOutcome({ kind: "prepared", recordId: body.recordId, sequence: body.sequence });
        setContent("");
        router.refresh();
      } else if (body.error === "policy_denied") {
        setOutcome({ kind: "denied", reason: body.reason });
        router.refresh();
      } else {
        setOutcome({ kind: "error", message: body.error ?? `http_${res.status}` });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-neutral-300">Prepare a follow-up record</p>
      <p className="mt-1 text-xs text-neutral-500">
        Identifiers are replaced before anything is encrypted. Preparing does not share it: the
        record still needs its own fresh approval.
      </p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder="e.g. Follow-up check-in. Call me on 090-1234-5678."
        className="mt-3 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200"
      />
      <button
        onClick={prepare}
        disabled={busy || !content.trim()}
        className="mt-3 rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
      >
        {busy ? "Preparing…" : "Prepare follow-up"}
      </button>

      {outcome?.kind === "prepared" && (
        <p className="mt-3 text-sm text-neutral-300">
          Follow-up #{outcome.sequence} prepared. It is not shared yet. Approve it from the list above.
        </p>
      )}
      {outcome?.kind === "denied" && (
        <p className="mt-3 text-sm text-red-300">
          Refused before the chain. Nothing was shared.{" "}
          {outcome.reason in DENY_REASON_TEXT && DENY_REASON_TEXT[outcome.reason as DenyReason]}
        </p>
      )}
      {outcome?.kind === "error" && (
        <p className="mt-3 text-sm text-red-300">Could not prepare: {outcome.message}</p>
      )}
    </div>
  );
}
