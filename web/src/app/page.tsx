import { ConnectButton } from "./connect-button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
            ReleaseKey
          </p>
          <h1 className="text-xl font-medium text-neutral-100">
            Your records. Your call.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-500">
            No account to remember, nothing to write down. Your device
            confirms it&apos;s you — that&apos;s the whole sign-in.
          </p>
        </div>

        <ConnectButton />

        <a
          href="/release"
          className="mt-6 block text-center text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-300"
        >
          Try the release flow →
        </a>

        <p className="mt-8 text-center text-xs text-neutral-600">
          Nothing is shared until you say so — every time.
        </p>
      </div>
    </main>
  );
}
