import { ReleaseFlowClient } from "./release-flow-client";
import { DOCTORS } from "@/lib/doctors";

// Phase 1.5: /doctors links here with ?doctorId=. Only a doctor with a
// published key is accepted; anything else falls back to the normal picker.
type SearchParams = Promise<{ doctorId?: string }>;

export default async function ReleasePage({ searchParams }: { searchParams: SearchParams }) {
  const { doctorId } = await searchParams;
  const initialDoctorId = DOCTORS.find((d) => d.id === doctorId)?.id ?? null;

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
            ReleaseKey
          </p>
          <h1 className="text-xl font-medium text-neutral-100">Prepare, then release</h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-500">
            An agent can prepare a record, but only you — verified fresh with
            World ID, right now — can release it.
          </p>
        </div>
        <ReleaseFlowClient initialDoctorId={initialDoctorId} />
      </div>
    </main>
  );
}
