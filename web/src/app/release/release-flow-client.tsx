"use client";

import { useState } from "react";

// Client-side glue for the demo flow:
// 1. "Prepare a record" → POST /api/records (agent, AGENT_ROLE key)
// 2. "Release" → full-page navigation to /api/world/authorize?recordId=...
//    (a real browser redirect — this is the "fresh human verification at
//    the moment of release" step, so it must never be an XHR/fetch call).
const RECIPIENT_ENS = "releasekey.eth";

export function ReleaseFlowClient() {
  const [recordId, setRecordId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [ciphertextPreview, setCiphertextPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const prepareRecord = async () => {
    setPending(true);
    setStatus(null);
    setCiphertextPreview(null);
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEns: RECIPIENT_ENS }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "failed");
      setRecordId(body.recordId);
      if (body.encryptedContent) {
        setCiphertextPreview(body.encryptedContent.ciphertext);
        setStatus(
          `Prepared. Content encrypted to ${RECIPIENT_ENS}'s public key (looked up from its ENS text record) — nothing is shared yet, and only that key's owner can ever decrypt it.`
        );
      } else {
        setStatus("Prepared. Nothing is shared yet — this only registered a commitment.");
      }
    } catch {
      setStatus("Could not prepare a record. Check the server logs.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {!recordId ? (
        <button
          onClick={prepareRecord}
          disabled={pending}
          className="w-full rounded-full bg-neutral-100 px-8 py-3.5 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:opacity-60"
        >
          {pending ? "Preparing…" : "Prepare a record"}
        </button>
      ) : (
        <>
          <p className="font-mono text-xs break-all text-neutral-500">{recordId}</p>
          <a
            href={`/api/world/authorize?recordId=${recordId}`}
            className="w-full rounded-full bg-emerald-500 px-8 py-3.5 text-sm font-medium text-neutral-950 transition hover:bg-emerald-400"
          >
            Release (verify with World ID)
          </a>
        </>
      )}
      {status && <p className="max-w-xs text-xs text-neutral-500">{status}</p>}
      {ciphertextPreview && (
        <p className="max-w-xs break-all font-mono text-[10px] text-neutral-600">
          ciphertext: {ciphertextPreview.slice(0, 40)}…
        </p>
      )}
    </div>
  );
}
