"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Phase 1.5 part 2: the doctor books a follow-up from this record. Booking opens
// a thread and shares nothing. Each follow-up record in it needs its own approval.
export function BookFollowupButton({ recordId }: { recordId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const book = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recordId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? `http_${res.status}`);
        return;
      }
      router.push(`/thread/${body.threadId}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={book}
        disabled={busy}
        className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 hover:border-neutral-600 disabled:opacity-50"
      >
        {busy ? "Booking…" : "Doctor: book a follow-up thread"}
      </button>
      {error && <p className="mt-2 text-xs text-red-300">Could not book: {error}</p>}
    </div>
  );
}
