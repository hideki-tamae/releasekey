"use client";

import { useEffect, useRef, useState } from "react";
import { DOCTORS } from "@/lib/doctors";
import { SharePreview, type Disclosure } from "./share-preview";

// Client-side glue for the demo flow:
// 1. Check-in text comes from one of two inputs that share one path:
//    - "Start recording" → browser speech-to-text (Web Speech API). It runs
//      until the person presses Stop (60 s cap) and shows the words live.
//      Transcription only, no voice/emotion/health inference (SPEC.md §3).
//      Chrome may send audio to Google's speech servers as part of how the
//      browser implements the API; we only ever receive the resulting text.
//    - Paste / type text: the same textarea, for demos and when speech is
//      unavailable.
//    Nothing is sent automatically. The person reviews the text, then presses
//    "Send". Sending calls the same POST /api/records either way.
// 2. "Confirm & continue" → full-page navigation to /api/world/authorize
//    (a real browser redirect — this is the "fresh human verification at the
//    moment of release" step, so it must never be an XHR/fetch call).
const MAX_LISTEN_MS = 60_000;
// Chrome can end a session on its own during silence. Restart unless the
// person pressed Stop. Fatal errors stop the session and are shown.
const NON_FATAL_SPEECH_ERRORS = ["no-speech", "aborted"];

type Stage = "picking" | "idle" | "listening" | "preparing" | "ready" | "denied";

// Turns an API failure into a sentence the person can act on. Nothing is sent
// in any of these cases, so the text stays in the box for a retry.
function describeSendError(status: number, error: string | undefined): string {
  switch (error) {
    case "encryption_failed":
      return `The recipient's encryption key could not be read from ENS, so nothing was sent (HTTP ${status}, encryption_failed). Try again in a moment.`;
    case "create_commitment_failed":
      return `The commitment could not be written to Sepolia, so nothing was sent (HTTP ${status}, create_commitment_failed).`;
    case "missing_record_id":
      return `The server did not accept the request (HTTP ${status}).`;
    default:
      return `Could not prepare the record: ${error ?? "unknown error"} (HTTP ${status}). Nothing was sent.`;
  }
}

export function ReleaseFlowClient({ initialDoctorId = null }: { initialDoctorId?: string | null }) {
  const [stage, setStage] = useState<Stage>(initialDoctorId ? "idle" : "picking");
  const [doctorId, setDoctorId] = useState<string | null>(initialDoctorId);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [ciphertextPreview, setCiphertextPreview] = useState<string | null>(null);
  // The one text box: live transcript while listening, editable text otherwise.
  const [text, setText] = useState("");
  const [speechNote, setSpeechNote] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentContent, setSentContent] = useState<string | null>(null);
  const [disclosure, setDisclosure] = useState<Disclosure | null>(null);
  const [denial, setDenial] = useState<{ reason: string; message: string } | null>(null);

  // Speech session state. Refs, because the recognizer's callbacks outlive renders.
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const committedRef = useRef("");
  const interimRef = useRef("");
  const stopRequestedRef = useRef(false);
  const finishedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doctor = DOCTORS.find((d) => d.id === doctorId);

  // Stop any live session when the page is left.
  useEffect(() => {
    return () => {
      stopRequestedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      try {
        recognitionRef.current?.abort();
      } catch {
        // already stopped
      }
    };
  }, []);

  const finishListening = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    recognitionRef.current = null;
    setText((committedRef.current + interimRef.current).trim());
    setStage("idle");
  };

  const stopListening = () => {
    stopRequestedRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {
      // already stopped
    }
    // Chrome can leave `stop()` hanging, so finish anyway after a short wait.
    setTimeout(finishListening, 1500);
  };

  const startListening = () => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechNote("This browser does not support speech recognition. Paste or type the text instead.");
      return;
    }

    setSpeechNote(null);
    setSendError(null);
    setStatus(null);
    committedRef.current = "";
    interimRef.current = "";
    stopRequestedRef.current = false;
    finishedRef.current = false;
    setText("");

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) committedRef.current += result[0].transcript + " ";
        else interim += result[0].transcript;
      }
      interimRef.current = interim;
      setText((committedRef.current + interim).trim());
    };

    recognition.onerror = (event) => {
      if (NON_FATAL_SPEECH_ERRORS.includes(event.error)) return;
      setSpeechNote(`Speech recognition stopped: ${event.error}. The words heard so far are kept below.`);
      stopRequestedRef.current = true;
    };

    recognition.onend = () => {
      if (!stopRequestedRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // could not restart; finish with what we have
        }
      }
      finishListening();
    };

    recognitionRef.current = recognition;
    setStage("listening");
    try {
      recognition.start();
    } catch {
      setSpeechNote("Could not start the microphone. Paste or type the text instead.");
      finishListening();
      return;
    }
    timerRef.current = setTimeout(() => {
      setSpeechNote("Stopped at the 60-second limit. Review the text, then send.");
      stopListening();
    }, MAX_LISTEN_MS);
  };

  // The one path for both voice and pasted text. Sends only on an explicit press.
  const send = async () => {
    if (!doctor) return;
    const content = text.trim();
    if (!content) {
      setSendError("There is nothing to send yet. Record, or paste some text, first.");
      return;
    }

    setSendError(null);
    setStatus(null);
    setCiphertextPreview(null);
    setDisclosure(null);
    setDenial(null);
    setSentContent(content);
    setStage("preparing");

    let res: Response;
    try {
      res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId: doctor.id, content }),
      });
    } catch {
      setSendError("Could not reach the server. Nothing was sent. Your text is still here, so you can send it again.");
      setStage("idle");
      return;
    }

    const body = await res.json().catch(() => ({}));
    if (body.disclosure) setDisclosure(body.disclosure);

    // v2: a policy refusal is a normal, explained outcome — not an error.
    if (res.status === 403 && body.error === "policy_denied") {
      setRecordId(body.recordId);
      setDenial({ reason: body.reason, message: body.message });
      setStage("denied");
      return;
    }

    if (!res.ok) {
      setSendError(describeSendError(res.status, body.error));
      setStage("idle");
      return;
    }

    setRecordId(body.recordId);
    if (body.encryptedContent) {
      setCiphertextPreview(body.encryptedContent.ciphertext);
      setStatus(
        `Encrypted to ${doctor.label}'s public key (looked up from its ENS text record) — nothing is shared yet, and only that key's owner can ever decrypt it.`
      );
    } else {
      setStatus("Prepared. Nothing is shared yet — this only registered a commitment.");
    }
    setStage("ready");
  };

  const listening = stage === "listening";

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

      {(stage === "idle" || stage === "listening") && (
        <div className="flex w-full flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-5 text-left">
          <label className="text-xs text-neutral-500" htmlFor="check-in-text">
            {listening ? "Listening… (live transcript)" : "Check-in text — record it, or paste or type it"}
          </label>
          <textarea
            id="check-in-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            readOnly={listening}
            rows={4}
            placeholder="e.g. My name is Taro. I have a question about my medication."
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600"
          />

          {listening ? (
            <button
              onClick={stopListening}
              className="w-full rounded-full bg-red-500 px-6 py-3 text-sm font-medium text-neutral-950 transition hover:bg-red-400"
            >
              <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-neutral-950" />
              Stop recording
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={startListening}
                className="flex-1 rounded-full border border-neutral-700 bg-neutral-100 px-5 py-3 text-sm font-medium text-neutral-950 transition hover:bg-white"
              >
                🎙 Start recording
              </button>
              <button
                onClick={send}
                disabled={!text.trim()}
                className="flex-1 rounded-full bg-emerald-500 px-5 py-3 text-sm font-medium text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-40"
              >
                Send
              </button>
            </div>
          )}

          {speechNote && <p className="text-xs text-amber-300">{speechNote}</p>}
          {sendError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {sendError}
            </div>
          )}
          {!listening && (
            <p className="text-[11px] text-neutral-600">
              Nothing is sent until you press Send. Pressing it runs the same checks and encryption for typed and spoken text.
            </p>
          )}
        </div>
      )}

      {stage === "preparing" && (
        <p className="text-sm text-neutral-400">Preparing your record…</p>
      )}

      {stage === "ready" && recordId && doctor && (
        <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-6 py-5 text-left">
          <p className="mb-3 text-xs uppercase tracking-wide text-neutral-500">Check-in — report</p>
          {sentContent && (
            <p className="mb-3 rounded-lg bg-neutral-950 px-3 py-2 text-xs italic text-neutral-500">
              You said: &ldquo;{sentContent}&rdquo;{" "}
              <span className="not-italic text-neutral-600">(stays with you — not stored)</span>
            </p>
          )}
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Source</dt>
              <dd className="text-neutral-200">Voice or pasted text</dd>
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

      {(stage === "ready" || stage === "denied") && disclosure && <SharePreview disclosure={disclosure} />}

      {stage === "denied" && denial && (
        <div className="w-full rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-left">
          <p className="text-sm font-medium text-red-200">Not shared — stopped before anything happened</p>
          <p className="mt-1 text-xs text-red-200/80">{denial.message}</p>
          <p className="mt-2 font-mono text-[11px] text-red-300/70">
            reason: {denial.reason} · no on-chain call · logged to the audit trail
          </p>
          {recordId && (
            <a
              href={`/release/result?status=denied&reason=${denial.reason}&recordId=${recordId}`}
              className="mt-3 inline-block text-xs text-red-200 underline underline-offset-2"
            >
              See the audit trail
            </a>
          )}
          <button
            onClick={() => setStage("idle")}
            className="mt-3 block text-xs text-neutral-300 underline underline-offset-2"
          >
            Try again with fewer details
          </button>
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
