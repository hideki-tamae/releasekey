"use client";

import { useState } from "react";

// Client-side glue for the demo flow:
// 1. "Voice check-in" → requests real mic permission, shows a short
//    listening animation (the "recording" itself is not analyzed — no
//    speech-to-text, no voice/emotion inference; see SPEC.md §3 — this is
//    theater for the story, not a real capability), then
//    POST /api/records (agent, AGENT_ROLE key) prepares an encrypted
//    record for a fixed demo recipient.
// 2. "Release" → full-page navigation to /api/world/authorize?recordId=...
//    (a real browser redirect — this is the "fresh human verification at
//    the moment of release" step, so it must never be an XHR/fetch call).
const RECIPIENT_ENS = "releasekey.eth";
const LISTEN_DURATION_MS = 2500;

type Stage = "idle" | "listening" | "preparing" | "ready";

export function ReleaseFlowClient() {
  const [stage, setStage] = useState<Stage>("idle");
  const [recordId, setRecordId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [ciphertextPreview, setCiphertextPreview] = useState<string | null>(null);

  const startVoiceCheckIn = async () => {
    setStatus(null);
    setCiphertextPreview(null);

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus(
        "Microphone permission was denied — continuing without it (this demo never analyzes audio anyway)."
      );
    }

    setStage("listening");
    await new Promise((resolve) => setTimeout(resolve, LISTEN_DURATION_MS));
    stream?.getTracks().forEach((track) => track.stop());

    setStage("preparing");
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
          `Encrypted to ${RECIPIENT_ENS}'s public key (looked up from its ENS text record) — nothing is shared yet, and only that key's owner can ever decrypt it.`
        );
      } else {
        setStatus("Prepared. Nothing is shared yet — this only registered a commitment.");
      }
      setStage("ready");
    } catch {
      setStatus("Could not prepare a record. Check the server logs.");
      setStage("idle");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-xs text-neutral-500">
        Recipient: <span className="text-neutral-300">Bob (the doctor)</span>{" "}
        <span className="font-mono text-neutral-500">— {RECIPIENT_ENS}</span>
      </p>

      {stage === "idle" && (
        <button
          onClick={startVoiceCheckIn}
          className="w-full rounded-full bg-neutral-100 px-8 py-3.5 text-sm font-medium text-neutral-950 transition hover:bg-white"
        >
          🎙 Start voice check-in
        </button>
      )}

      {stage === "listening" && (
        <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 px-8 py-6">
          <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
          <p className="text-sm text-neutral-300">Listening…</p>
        </div>
      )}

      {stage === "preparing" && (
        <p className="text-sm text-neutral-400">Preparing your record…</p>
      )}

      {stage === "ready" && recordId && (
        <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-6 py-5 text-left">
          <p className="mb-3 text-xs uppercase tracking-wide text-neutral-500">
            Voice check-in — report
          </p>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Source</dt>
              <dd className="text-neutral-200">Voice check-in (synthetic demo audio)</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Recipient</dt>
              <dd className="text-neutral-200">
                Bob (the doctor) <span className="font-mono text-neutral-500">— {RECIPIENT_ENS}</span>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Content</dt>
              <dd className="text-neutral-200">Encrypted — not readable by anyone yet</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Status</dt>
              <dd className="text-amber-300">Awaiting your approval</dd>
            </div>
          </dl>
        </div>
      )}

      {stage === "ready" && recordId && (
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
