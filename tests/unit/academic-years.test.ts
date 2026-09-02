import { describe, expect, it } from "vitest";
import { validateAcademicYearDates } from "@/lib/academic-years";
import { STUDENT_STATUSES, type StudentStatus } from "@/types/enums";

describe("validateAcademicYearDates", () => {
  it("accepts a valid ISO date range", () => {
    expect(validateAcademicYearDates("2026-09-01", "2027-06-30")).toBeNull();
  });

  it("rejects an end date not strictly after the start date", () => {
    expect(validateAcademicYearDates("2026-09-01", "2026-09-01")).toBe(
      "La date de fin doit être postérieure à la date de début"
    );
    expect(validateAcademicYearDates("2026-09-01", "2026-08-31")).toBe(
      "La date de fin doit être postérieure à la date de début"
    );
  });

  it("rejects malformed dates", () => {
    expect(validateAcademicYearDates("01/09/2026", "2027-06-30")).toBe(
      "Date de début invalide"
    );
    expect(validateAcademicYearDates("2026-09-01", "2027/06/30")).toBe(
      "Date de fin invalide"
    );
  });
});

describe("STUDENT_STATUSES", () => {
  it("exposes the canonical lifecycle statuses", () => {
    expect(STUDENT_STATUSES).toEqual([
      "active",
      "inactive",
      "graduated",
      "transferred",
    ]);
    const valid: StudentStatus[] = ["active", "inactive", "graduated", "transferred"];
    for (const s of valid) {
      expect(STUDENT_STATUSES).toContain(s);
    }
  });
});