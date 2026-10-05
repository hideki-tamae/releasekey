// Doctor search (SPEC-v2 §3, Phase 1.5 part 1).
//
// Pure functions, no I/O: filter and sort the doctor profiles by coarse area
// (prefecture / city) and by rating and review count. There is no precise
// location anywhere in this path. The query is never stored or logged; it
// only shapes the list on screen.
//
// Fail-closed on input: a rating or count that is not a valid number in its
// range is ignored (treated as "no filter"), never widened to something else.

import type { DoctorProfile } from "./doctors";

export type DoctorQuery = {
  prefecture?: string;
  city?: string;
  /** 1.0–5.0 */
  minRating?: number;
  /** integer ≥ 0 */
  minReviews?: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function firstString(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

/** Parses URL search params. Invalid values are dropped, not guessed at. */
export function parseDoctorQuery(params: RawParams): DoctorQuery {
  const query: DoctorQuery = {};

  const prefecture = firstString(params.prefecture);
  if (prefecture) query.prefecture = prefecture;

  const city = firstString(params.city);
  if (city) query.city = city;

  const minRating = Number(firstString(params.minRating));
  if (Number.isFinite(minRating) && minRating >= 1 && minRating <= 5) {
    query.minRating = minRating;
  }

  const minReviews = Number(firstString(params.minReviews));
  if (Number.isInteger(minReviews) && minReviews >= 0) {
    query.minReviews = minReviews;
  }

  return query;
}

/** Returns the doctors that match, highest rating first, then most reviews. */
export function searchDoctors(profiles: DoctorProfile[], query: DoctorQuery): DoctorProfile[] {
  return profiles
    .filter((d) => {
      if (query.prefecture && d.area.prefecture !== query.prefecture) return false;
      if (query.city && d.area.city !== query.city) return false;
      if (query.minRating !== undefined && d.rating < query.minRating) return false;
      if (query.minReviews !== undefined && d.reviewCount < query.minReviews) return false;
      return true;
    })
    .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount || a.id.localeCompare(b.id));
}
