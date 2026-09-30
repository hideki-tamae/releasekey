"use client";

import { useEffect, useState } from "react";

// v2 (SPEC-v2 §3.5–3.6): shows every step this record went through —
// including refusals — and whether the hash chain still verifies.

type Entry = {
  index: number;
  type: string;
  reason?: string;
  details?: Record<string, string | number | boolean>;
  at: number;
  hash: string;
};

type AuditResponse = {
  entries: Entry[];
  chain: { ok: boolean; length: number; head: string; brokenAt?: number };
};

const LABEL: Record<string, { text: string; tone: string }> = {
  redacted: { text: "Identifiers removed & risk scored", tone: "text-sky-300" },
  policy_denied: { text: "Refused by your policy", tone: "text-red-300" },
  prepared: { text: "Prepared by the agent (commitment on-chain)", tone: "text-neutral-300" },
  verification_denied: { text: "Human verification did not pass", tone: "text-red-300" },
  approved: { text: "Approved by a fresh human verification", tone: "text-emerald-300" },
  access_granted: { text: "Recipient opened it", tone: "text-emerald-300" },
  access_refused: { text: "Access refused (not approved / revoked / expired)", tone: "text-red-300" },
  revoked: { text: "Revoked by you", tone: "text-amber-300" },
};

export function AuditTrail({ recordId }: { recordId: string }) {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`/api/audit/${recordId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: AuditResponse | null) => {
        if (alive && body) setData(body);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [recordId, refreshKey]);

  if (!data) return null;

  return (
    <div className="mt-6 w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-4 text-left">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Audit trail</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            data.chain.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
          }`}
        >
          {data.chain.ok ? "✓ hash chain verified" : `✗ chain broken at #${data.chain.brokenAt}`}
        </span>
      </div>
      {data.entries.length === 0 ? (
        <p className="text-xs text-neutral-500">No entries yet (the log lives in this server&apos;s memory).</p>
      ) : (
        <ol className="space-y-1.5">
          {data.entries.map((e) => {
            const l = LABEL[e.type] ?? { text: e.type, tone: "text-neutral-300" };
            return (
              <li key={e.index} className="text-xs">
                <span className={l.tone}>{l.text}</span>
                {e.reason && <span className="ml-1 font-mono text-neutral-500">({e.reason})</span>}
                <span className="ml-2 font-mono text-[10px] text-neutral-600">
                  {new Date(e.at).toLocaleTimeString()} · {e.hash.slice(0, 10)}…
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <button onClick={() => setRefreshKey((k) => k + 1)} className="mt-3 text-[11px] text-neutral-500 underline underline-offset-2">
        Refresh
      </button>
    </div>
  );
}
