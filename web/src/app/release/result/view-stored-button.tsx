"use client";

import { useState } from "react";

// Transparency button: shows exactly what's stored server-side for this
// record — still encrypted, no approval needed to view it (it's ciphertext,
// safe to show freely). Contrast with AccessReportButton, which requires
// approval and returns the decrypted plaintext.
type StoredData = {
  storageLocation: string;
  storedAt: string;
  recipientEns: string;
  encryptedContent: { ciphertext: string };
};

export function ViewStoredButton({ recordId }: { recordId: string }) {
  const [state, setState] = useState<"idle" | "pending" | "shown" | "error">("idle");
  const [data, setData] = useState<StoredData | null>(null);

  const view = async () => {
    setState("pending");
    try {
      const res = await fetch(`/api/records/${recordId}/stored`);
      if (!res.ok) throw new Error("failed");
      setData(await res.json());
      setState("shown");
    } catch {
      setState("error");
    }
  };

  const download = (payload: StoredData) => {
    // Downloads exactly what's stored server-side — still ciphertext, so
    // this is safe to hand out freely, same reasoning as the button itself.
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voice-checkin-${recordId.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (state === "shown" && data) {
    return (
      <div className="mt-6 w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-6 py-4 text-left">
        <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
          Stored record (still encrypted)
        </p>
        <dl className="space-y-1.5 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Storage</dt>
            <dd className="text-neutral-300">{data.storageLocation}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Stored at</dt>
            <dd className="text-neutral-300">{data.storedAt}</dd>
          </div>
        </dl>
        <p className="mt-3 break-all font-mono text-[10px] text-neutral-600">
          {data.encryptedContent.ciphertext}
        </p>
        <button
          onClick={() => download(data)}
          className="mt-4 w-full rounded-full border border-neutral-700 bg-neutral-950 px-4 py-2 text-xs font-medium text-neutral-300 transition hover:bg-neutral-800"
        >
          ⬇ Download encrypted report (.json)
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <button
        onClick={view}
        disabled={state === "pending"}
        className="rounded-full border border-neutral-700 bg-neutral-900 px-6 py-2 text-xs font-medium text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-60"
      >
        {state === "pending" ? "Loading…" : "View stored report (encrypted)"}
      </button>
      {state === "error" && (
        <p className="text-xs text-neutral-500">Could not load. Check the server logs.</p>
      )}
    </div>
  );
}
