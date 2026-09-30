"use client";

// v2 "visible boundary" (SPEC-v2 §3.6): before anything is released, the
// person sees exactly what would be shared, what was removed, how
// re-identifiable the rest still is, and which policy decided it.

export type Disclosure = {
  mode: "redacted" | "full";
  sharedText: string;
  removed: Record<string, number> | null;
  totalRedacted: number;
  risk: { score: number; signals: { signal: string; count: number }[] };
  policy: { source: "default" | "ens"; maxReidRisk: number; maxTtlSeconds: number; disclosure: string };
};

const CATEGORY_LABEL: Record<string, string> = {
  EMAIL: "email",
  URL: "link",
  PHONE: "phone",
  ID_NUMBER: "ID number",
  POSTAL_CODE: "postal code",
  DATE: "date",
};

const SIGNAL_LABEL: Record<string, string> = {
  exact_age: "exact age",
  named_place: "named place",
  occupation: "occupation",
  family_detail: "family detail",
  rare_attribute: "rare attribute",
  residual_number: "number",
  capitalized_name: "possible name",
};

export function SharePreview({ disclosure }: { disclosure: Disclosure }) {
  const { risk, policy } = disclosure;
  const over = risk.score > policy.maxReidRisk;
  const removed = Object.entries(disclosure.removed ?? {}).filter(([, n]) => n > 0);

  return (
    <div className="w-full space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-4 text-left">
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
          What would be shared {disclosure.mode === "redacted" && "(identifiers removed)"}
        </p>
        <p className="rounded-lg bg-neutral-950 px-3 py-2 text-xs text-neutral-300">{disclosure.sharedText}</p>
      </div>

      {disclosure.mode === "redacted" && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-neutral-500">Removed:</span>
          {removed.length === 0 ? (
            <span className="text-neutral-400">nothing needed removing</span>
          ) : (
            removed.map(([cat, n]) => (
              <span key={cat} className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-300">
                {n} × {CATEGORY_LABEL[cat] ?? cat}
              </span>
            ))
          )}
        </div>
      )}

      <div>
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-neutral-500">Could this still point to you? (heuristic)</span>
          <span className={over ? "text-red-300" : "text-emerald-300"}>
            {risk.score} / 100 · limit {policy.maxReidRisk}
          </span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            className={`h-full ${over ? "bg-red-500" : "bg-emerald-500"}`}
            style={{ width: `${risk.score}%` }}
          />
          <div className="absolute top-0 h-full w-0.5 bg-neutral-300" style={{ left: `${policy.maxReidRisk}%` }} />
        </div>
        {risk.signals.length > 0 && (
          <p className="mt-1 text-[11px] text-neutral-500">
            Found: {risk.signals.map((s) => SIGNAL_LABEL[s.signal] ?? s.signal).join(", ")}
          </p>
        )}
      </div>

      <p className="text-[11px] text-neutral-500">
        Policy: {policy.source === "ens" ? "your ENS text records" : "strict default"} · disclosure{" "}
        {policy.disclosure} · approval lasts at most {Math.round(policy.maxTtlSeconds / 60)} min
      </p>
    </div>
  );
}
