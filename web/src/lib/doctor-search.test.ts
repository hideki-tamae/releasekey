import { describe, expect, it } from "vitest";
import { DOCTORS, DOCTOR_PROFILES, UNKEYED_DOCTORS, getDoctor, type DoctorProfile } from "./doctors";
import { parseDoctorQuery, searchDoctors } from "./doctor-search";

const fixture: DoctorProfile[] = [
  { id: "a", label: "A", area: { prefecture: "東京都", city: "千代田区" }, rating: 4.5, reviewCount: 10, hasEncryptionKey: true },
  { id: "b", label: "B", area: { prefecture: "東京都", city: "世田谷区" }, rating: 4.5, reviewCount: 30, hasEncryptionKey: false },
  { id: "c", label: "C", area: { prefecture: "大阪府", city: "大阪市北区" }, rating: 3.0, reviewCount: 99, hasEncryptionKey: true },
  { id: "d", label: "D", area: { prefecture: "東京都", city: "千代田区" }, rating: 5.0, reviewCount: 1, hasEncryptionKey: false },
];

describe("searchDoctors", () => {
  it("returns everyone when the query is empty", () => {
    expect(searchDoctors(fixture, {})).toHaveLength(4);
  });

  it("filters by prefecture and by city within it", () => {
    expect(searchDoctors(fixture, { prefecture: "東京都" }).map((d) => d.id)).toEqual(["d", "b", "a"]);
    expect(searchDoctors(fixture, { prefecture: "東京都", city: "千代田区" }).map((d) => d.id)).toEqual(["d", "a"]);
  });

  it("filters by minimum rating and minimum review count", () => {
    expect(searchDoctors(fixture, { minRating: 4.5 }).map((d) => d.id)).toEqual(["d", "b", "a"]);
    expect(searchDoctors(fixture, { minReviews: 30 }).map((d) => d.id)).toEqual(["b", "c"]);
  });

  it("sorts by rating, then by review count, then by id", () => {
    expect(searchDoctors(fixture, {}).map((d) => d.id)).toEqual(["d", "b", "a", "c"]);
  });

  it("returns an empty list, without throwing, when nothing matches", () => {
    expect(searchDoctors(fixture, { prefecture: "北海道" })).toEqual([]);
  });

  it("does not mutate the input list", () => {
    const before = fixture.map((d) => d.id);
    searchDoctors(fixture, {});
    expect(fixture.map((d) => d.id)).toEqual(before);
  });
});

describe("parseDoctorQuery (fail-closed on bad input)", () => {
  it("reads valid values", () => {
    expect(
      parseDoctorQuery({ prefecture: " 東京都 ", city: "千代田区", minRating: "4", minReviews: "10" })
    ).toEqual({ prefecture: "東京都", city: "千代田区", minRating: 4, minReviews: 10 });
  });

  it("ignores empty values", () => {
    expect(parseDoctorQuery({ prefecture: "  ", city: "" })).toEqual({});
  });

  it("drops out-of-range or non-numeric ratings and counts", () => {
    expect(parseDoctorQuery({ minRating: "0" })).toEqual({});
    expect(parseDoctorQuery({ minRating: "6" })).toEqual({});
    expect(parseDoctorQuery({ minRating: "abc" })).toEqual({});
    expect(parseDoctorQuery({ minReviews: "-1" })).toEqual({});
    expect(parseDoctorQuery({ minReviews: "2.5" })).toEqual({});
  });

  it("takes the first value when a param is repeated", () => {
    expect(parseDoctorQuery({ prefecture: ["東京都", "大阪府"] })).toEqual({ prefecture: "東京都" });
  });
});

describe("demo doctor directory", () => {
  it("only doctors with a published key can be resolved as recipients", () => {
    for (const d of DOCTORS) {
      expect(d.hasEncryptionKey).toBe(true);
      expect(getDoctor(d.id)).toBe(d);
    }
    for (const d of UNKEYED_DOCTORS) {
      expect(d.hasEncryptionKey).toBe(false);
      expect(getDoctor(d.id)).toBeUndefined();
    }
  });

  it("every listed doctor has a coarse area and a rating in 1.0–5.0", () => {
    expect(DOCTOR_PROFILES.length).toBe(DOCTORS.length + UNKEYED_DOCTORS.length);
    for (const d of DOCTOR_PROFILES) {
      expect(d.area.prefecture.length).toBeGreaterThan(0);
      expect(d.area.city.length).toBeGreaterThan(0);
      expect(d.rating).toBeGreaterThanOrEqual(1);
      expect(d.rating).toBeLessThanOrEqual(5);
    }
  });
});
