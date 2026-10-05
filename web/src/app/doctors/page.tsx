import Link from "next/link";
import { DOCTOR_PROFILES, type DoctorProfile } from "@/lib/doctors";
import { parseDoctorQuery, searchDoctors } from "@/lib/doctor-search";

// Phase 1.5: find a doctor by coarse area and rating. The filter is a plain
// GET form, so it works without client JavaScript and the query stays in the
// URL only. Nothing is stored or logged. Every doctor, rating and review count
// here is SYNTHETIC demo data. Only doctors with a published key can be chosen.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PREFECTURES = Array.from(new Set(DOCTOR_PROFILES.map((d) => d.area.prefecture))).sort();
const MIN_RATINGS = ["3.0", "4.0", "4.5"] as const;
const MIN_REVIEWS = ["10", "20", "50"] as const;

const selectClass =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200";

function DoctorCard({ doctor }: { doctor: DoctorProfile }) {
  return (
    <li className="rounded-2xl border border-neutral-800 bg-neutral-900 px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-100">{doctor.label}</p>
          <p className="mt-1 text-xs text-neutral-400">
            {doctor.area.prefecture} {doctor.area.city}
          </p>
        </div>
        <p className="shrink-0 text-right text-sm text-amber-300">
          ★ {doctor.rating.toFixed(1)}
          <span className="block text-[11px] text-neutral-500">
            {doctor.reviewCount} reviews (demo)
          </span>
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
            doctor.hasEncryptionKey
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-neutral-700/40 text-neutral-400"
          }`}
        >
          {doctor.hasEncryptionKey ? "Key published" : "No key — sharing not possible"}
        </span>
        {doctor.hasEncryptionKey && (
          <Link
            href={`/release?doctorId=${doctor.id}`}
            className="text-sm text-neutral-200 underline underline-offset-4 hover:text-white"
          >
            Choose this doctor →
          </Link>
        )}
      </div>
    </li>
  );
}

export default async function DoctorsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseDoctorQuery(await searchParams);
  const results = searchDoctors(DOCTOR_PROFILES, query);

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <p className="text-xs uppercase tracking-wide text-neutral-500">RELEASEKEY</p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-100">Find a doctor</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Search by prefecture and city (no precise location is used), and by rating. Every doctor,
          rating and review count on this page is synthetic demo data, not a real review.
        </p>

        <form method="get" className="mt-8 grid grid-cols-1 gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 sm:grid-cols-2">
          <label className="text-xs text-neutral-500">
            Prefecture
            <select name="prefecture" defaultValue={query.prefecture ?? ""} className={`${selectClass} mt-1`}>
              <option value="">Any</option>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-500">
            City
            <input
              name="city"
              defaultValue={query.city ?? ""}
              placeholder="e.g. 千代田区"
              className={`${selectClass} mt-1`}
            />
          </label>
          <label className="text-xs text-neutral-500">
            Minimum rating (demo)
            <select name="minRating" defaultValue={query.minRating?.toFixed(1) ?? ""} className={`${selectClass} mt-1`}>
              <option value="">Any</option>
              {MIN_RATINGS.map((r) => (
                <option key={r} value={r}>
                  {r} and up
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-500">
            Minimum reviews (demo)
            <select name="minReviews" defaultValue={query.minReviews?.toString() ?? ""} className={`${selectClass} mt-1`}>
              <option value="">Any</option>
              {MIN_REVIEWS.map((n) => (
                <option key={n} value={n}>
                  {n} and up
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 flex items-center justify-between">
            <Link href="/doctors" className="text-xs text-neutral-500 underline underline-offset-4 hover:text-neutral-300">
              Reset
            </Link>
            <button
              type="submit"
              className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
            >
              Search
            </button>
          </div>
        </form>

        <p className="mt-8 text-xs text-neutral-500">
          {results.length} {results.length === 1 ? "doctor" : "doctors"} found
        </p>
        {results.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-400">No doctor matches these filters.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {results.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} />
            ))}
          </ul>
        )}

        <Link
          href="/release"
          className="mt-8 inline-block text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-300"
        >
          ← Back to /release
        </Link>
      </div>
    </main>
  );
}
