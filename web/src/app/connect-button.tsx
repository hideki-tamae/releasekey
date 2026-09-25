"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useConnect, useDisconnect } from "@jaw.id/wagmi";
import { config } from "@/lib/wagmi-config";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { mutate: connect, isPending } = useConnect();
  const { mutate: disconnect } = useDisconnect();
  const [error, setError] = useState<string | null>(null);

  if (isConnected && address) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Verified — ready to continue
        </div>
        <p className="font-mono text-xs text-neutral-500">
          {address.slice(0, 6)}…{address.slice(-4)}
        </p>
        <button
          onClick={() => disconnect({})}
          className="text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-300"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => {
          setError(null);
          connect(
            { connector: config.connectors[0] },
            { onError: (err) => setError(err.message) }
          );
        }}
        disabled={isPending}
        className="w-full rounded-full bg-neutral-100 px-8 py-3.5 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:opacity-60"
      >
        {isPending ? "Waiting for confirmation…" : "Unlock with Face ID / Passkey"}
      </button>
      {error && <p className="max-w-xs text-xs text-red-400">{error}</p>}
    </div>
  );
}
