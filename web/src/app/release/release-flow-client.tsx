"use client";

import { useState } from "react";
import { DOCTORS } from "@/lib/doctors";

// Client-side glue for the demo flow:
// 1. "Voice check-in" → real browser speech-to-text (Web Speech API) turns
//    what you actually say into text. This is transcription only — no
//    voice/emotion/health inference of any kind (see SPEC.md §3). Note:
//    in Chrome this sends audio to Google's speech servers as part of how
//    the browser implements the API; we never receive or store the raw
//    audio ourselves, only the resulting text. Falls back to a fixed demo
//    sentence if the browser doesn't support it or nothing was said.
//    That text becomes the record's real content — its hash is what gets
//    committed on-chain (see api/records/route.ts).
// 2. "Release" → full-page navigation to /api/world/authorize?recordId=...
//    (a real browser redirect — this is the "fresh human verification at
//    the moment of release" step, so it must never be an XHR/fetch call).
const LISTEN_DURATION_MS = 4000;

type Stage = "picking" | "idle" | "listening" | "preparing" | "ready";

export function ReleaseFlowClient() {
  const [stage, setStage] = useState<Stage>("picking");
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [ciphertextPreview, setCiphertextPreview] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [finalContent, setFinalContent] = useState<string | null>(null);

  const doctor = DOCTORS.find((d) => d.id === doctorId);

  const listenForSpeech = (): Promise<string> => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return Promise.resolve("");

    return new Promise((resolve) => {
      const recognition = new Recognition();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = true;

      let latest = ""; // best-so-far transcript (final + interim combined)
      let settled = false;
      const finish = (text: string) => {
        if (settled) return;
        settled = true;
        try {
          recognition.abort(); // hard-stop — Chrome can leave `stop()` hanging
        } catch {
          // already stopped
        }
        resolve(text.trim());
      };

      recognition.onresult = (event) => {
        let finalText = "";
        let interim = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0].transcript + " ";
          else interim += result[0].transcript;
        }
        latest = (finalText + interim).trim();
        setTranscript(latest);
      };
      recognition.onerror = () => finish(latest);
      recognition.onend = () => finish(latest);

      try {
        recognition.start();
      } catch {
        resolve("");
        return;
      }
      // Hard timeout: resolves with whatever was heard so far, no matter
      // what state the recognition engine is in — never blocks the flow.
      setTimeout(() => finish(latest), LISTEN_DURATION_MS);
    });
  };

  const startVoiceCheckIn = async () => {
    if (!doctor) return;
    setStatus(null);
    setCiphertextPreview(null);
    setTranscript("");
    setFinalContent(null);

    const fallbackContent =
      "Voice check-in received (speech recognition unavailable — using demo text). " +
      `The agent prepared this record for ${doctor.label} — content stays encrypted until a ` +
      "fresh human approval releases it.";

    setStage("listening");
    const spoken = await listenForSpeech();
    const content = spoken || fallbackContent;
    setFinalContent(content);
    if (!spoken) {
      setStatus("Couldn't hear anything (or speech recognition isn't supported here) — using demo text instead.");
    }

    setStage("preparing");
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId: doctor.id, content }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "failed");
      setRecordId(body.recordId);
      if (body.encryptedContent) {
        setCiphertextPreview(body.encryptedContent.ciphertext);
        setStatus(
          (prev) =>
            (prev ? prev + " " : "") +
            `Encrypted to ${doctor.label}'s public key (looked up from its ENS text record) — nothing is shared yet, and only that key's owner can ever decrypt it.`
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
      {stage === "picking" && (
        <>
          <p className="text-sm text-neutral-400">Choose who this check-in is for:</p>
          <div className="flex w-full flex-col gap-2">
            {DOCTORS.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setDoctorId(d.id);
                  setStage("idle");
                }}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left text-sm text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800"
              >
                {d.label}
                <span className="ml-2 font-mono text-xs text-neutral-500">
                  — {d.ensName} ({d.textRecordKey})
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {stage !== "picking" && doctor && (
        <p className="text-xs text-neutral-500">
          Recipient: <span className="text-neutral-300">{doctor.label}</span>{" "}
          <span className="font-mono text-neutral-500">— {doctor.ensName}</span>{" "}
          <button
            onClick={() => setStage("picking")}
            className="underline underline-offset-2 hover:text-neutral-300"
          >
            change
          </button>
        </p>
      )}

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
          <p className="text-sm text-neutral-300">Listening… speak now</p>
          {transcript && (
            <p className="mt-2 max-w-xs text-xs italic text-neutral-500">&ldquo;{transcript}&rdquo;</p>
          )}
        </div>
      )}

      {stage === "preparing" && (
        <p className="text-sm text-neutral-400">Preparing your record…</p>
      )}

      {stage === "ready" && recordId && doctor && (
        <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-6 py-5 text-left">
          <p className="mb-3 text-xs uppercase tracking-wide text-neutral-500">
            Voice check-in — report
          </p>
          {finalContent && (
            <p className="mb-3 rounded-lg bg-neutral-950 px-3 py-2 text-xs italic text-neutral-400">
              &ldquo;{finalContent}&rdquo;
            </p>
          )}
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Source</dt>
              <dd className="text-neutral-200">Voice check-in (live speech-to-text)</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Recipient</dt>
              <dd className="text-neutral-200">
                {doctor.label} <span className="font-mono text-neutral-500">— {doctor.ensName}</span>
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

      {stage === "ready" && recordId && doctor && (
        <>
          <p className="font-mono text-xs break-all text-neutral-500">{recordId}</p>
          <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-left text-xs text-amber-200">
            You are about to confirm releasing this record to{" "}
            <span className="font-medium">{doctor.label}</span>. Continuing takes you to
            World ID for a fresh, in-person verification — this cannot be undone by the
            agent afterward.
          </div>
          <a
            href={`/api/world/authorize?recordId=${recordId}`}
            className="w-full rounded-full bg-emerald-500 px-8 py-3.5 text-sm font-medium text-neutral-950 transition hover:bg-emerald-400"
          >
            Confirm & continue to World ID
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
