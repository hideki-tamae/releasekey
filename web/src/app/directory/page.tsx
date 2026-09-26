import { DOCTORS } from "@/lib/doctors";
import { getRecipientPublicKey } from "@/lib/ens-encryption";

// A live proof page for the demo: reads each doctor's encryption public
// key directly from ENS, right now, server-side — nothing here is
// hardcoded or cached. If ENS is unreachable or a record is missing,
// that shows up as an error, not a silently faked value.
export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const entries = await Promise.all(
    DOCTORS.map(async (doctor) => {
      try {
        const publicKey = await getRecipientPublicKey(doctor.ensName, doctor.textRecordKey);
        return { doctor, publicKey, error: null as string | null };
      } catch (err) {
        return { doctor, publicKey: null, error: (err as Error).message };
      }
    })
  );

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <p className="text-xs uppercase tracking-wide text-neutral-500">RELEASEKEY</p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-100">Recipient key directory</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Every value below was just read live from Sepolia ENS — a normal, free on-chain read
          anyone can do with any ENS-aware tool. Nothing here is hardcoded in this app; if a
          record didn&apos;t really exist on-chain, this page would show an error instead.
        </p>

        <div className="mt-8 space-y-4">
          {entries.map(({ doctor, publicKey, error }) => (
            <div
              key={doctor.id}
              className="rounded-2xl border border-neutral-800 bg-neutral-900 px-6 py-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-neutral-100">{doctor.label}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    publicKey
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "bg-red-500/10 text-red-300"
                  }`}
                >
                  {publicKey ? "Live on ENS" : "Not found"}
                </span>
              </div>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex gap-2">
                  <dt className="shrink-0 text-neutral-500">ENS name</dt>
                  <dd className="font-mono text-neutral-300">{doctor.ensName}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 text-neutral-500">Text record key</dt>
                  <dd className="font-mono text-neutral-300">{doctor.textRecordKey}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 text-neutral-500">Public key</dt>
                  <dd className="break-all font-mono text-neutral-400">
                    {publicKey ?? `error: ${error}`}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <a
          href="/release"
          className="mt-8 inline-block text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-300"
        >
          ← Back to /release
        </a>
      </div>
    </main>
  );
}
