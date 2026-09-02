import { describe, expect, it } from "vitest";
import { computeAverages, computeClassAverages } from "@/lib/db/academic";

function grade(score: number, max_score: number, coefficient: number, subject_id: string, subject_name?: string) {
  return { score, max_score, coefficient, subject_id, subject_name };
}

describe("computeAverages", () => {
  it("returns zeros and null average for no grades", () => {
    const r = computeAverages([]);
    expect(r.overall_average).toBeNull();
    expect(r.total_evals).toBe(0);
    expect(r.subjects).toEqual([]);
  });

  it("computes a simple average over 20 when max_score is 20", () => {
    const r = computeAverages([
      grade(15, 20, 1, "m1", "Maths"),
      grade(10, 20, 1, "m1", "Maths"),
    ]);
    expect(r.overall_average).toBe(12.5);
    expect(r.total_evals).toBe(2);
    expect(r.subjects[0].subject_name).toBe("Maths");
    expect(r.subjects[0].average).toBe(12.5);
  });

  it("normalizes different bases to /20", () => {
    const r = computeAverages([
      grade(18, 20, 1, "m1", "Maths"),
      grade(9, 10, 1, "m1", "Maths"),
    ]);
    // 18 and 9/10 => 18 -> each evaluates to 18 => average 18
    expect(r.overall_average).toBe(18);
  });

  it("weights by coefficient", () => {
    const r = computeAverages([
      grade(10, 20, 1, "m1", "Maths"),
      grade(20, 20, 3, "m1", "Maths"),
    ]);
    // weighted = (10*1 + 20*3)/(1+3) = 70/4 = 17.5
    expect(r.overall_average).toBe(17.5);
  });

  it("groups averages per subject", () => {
    const r = computeAverages([
      grade(10, 20, 1, "m1", "Maths"),
      grade(20, 20, 1, "m1", "Maths"),
      grade(12, 20, 1, "m2", "Français"),
    ]);
    const maths = r.subjects.find((s) => s.subject_id === "m1");
    const french = r.subjects.find((s) => s.subject_id === "m2");
    expect(maths?.average).toBe(15);
    expect(french?.average).toBe(12);
    // overall is coefficient-weighted across every grade: (10+20+12)/3 = 14
    expect(r.overall_average).toBe(14);
  });

  it("ignores rows with max_score <= 0", () => {
    const r = computeAverages([grade(10, 0, 1, "m1", "Maths")]);
    expect(r.total_evals).toBe(0);
    expect(r.overall_average).toBeNull();
  });
});

describe("computeClassAverages", () => {
  it("returns null for empty rows", () => {
    const r = computeClassAverages([]);
    expect(r.overall_average).toBeNull();
    expect(r.total_evals).toBe(0);
  });

  it("computes overall and per-class averages", () => {
    const r = computeClassAverages([
      { score: 15, max_score: 20, coefficient: 1, classroom_id: "c1" },
      { score: 10, max_score: 20, coefficient: 1, classroom_id: "c1" },
      { score: 8, max_score: 20, coefficient: 2, classroom_id: "c2" },
    ]);
    expect(r.overall_average).toBe(10.25); // (15+10+16)/4
    const c1 = r.byClass.get("c1");
    const c2 = r.byClass.get("c2");
    expect(c1?.count).toBe(2);
    expect(c2?.count).toBe(1);
    // c2 average = (8*2)/(2) = 8
    expect(Math.round(((c2!.wSum / c2!.cSum)) * 100) / 100).toBe(8);
  });

  it("assigns rows without a classroom nowhere in byClass", () => {
    const r = computeClassAverages([
      { score: 10, max_score: 20, coefficient: 1, classroom_id: null },
    ]);
    expect(r.byClass.size).toBe(0);
    expect(r.overall_average).toBe(10);
  });
});
