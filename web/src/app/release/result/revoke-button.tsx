"use client";

import { useState } from "react";

// SPEC.md §3 item 5: "User can revoke." POST /api/revoke calls the
// contract's revoke() with the APPROVER_ROLE key, held server-side.
export function RevokeButton({ recordId }: { recordId: string }) {
  const [state, setState] = useState<"idle" | "pending" | "revoked" | "error">("idle");

  const revoke = async () => {
    setState("pending");
    try {
      const res = await fetch("/api/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId }),
      });
      if (!res.ok) throw new Error("failed");
      setState("revoked");
    } catch {
      setState("error");
    }
  };

  if (state === "revoked") {
    return <p className="mt-6 text-xs text-neutral-500">Revoked. This release is no longer valid.</p>;
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <button
        onClick={revoke}
        disabled={state === "pending"}
        className="rounded-full border border-red-500/30 bg-red-500/10 px-6 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-60"
      >
        {state === "pending" ? "Revoking…" : "Revoke"}
      </button>
      {state === "error" && (
        <p className="text-xs text-neutral-500">Could not revoke. Check the server logs.</p>
      )}
    </div>
  );
}
