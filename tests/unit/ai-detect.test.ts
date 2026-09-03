import { describe, expect, it } from "vitest";
import { detectStudentRisks, detectClassAnomaly } from "@/lib/ai/risk/detect";
import type { StudentRiskInput } from "@/lib/ai/types";

function makeInput(over: Partial<StudentRiskInput> = {}): StudentRiskInput {
  return {
    schoolId: "sch-1",
    studentId: "stu-1",
    className: "6ème A",
    attendanceRatePct: 95,
    absenceRatePct: 5,
    lateCount: 0,
    lateDeltaPct: 0,
    lateRatePct: 0,
    currentAvg: 12,
    previousAvg: 12,
    classAvg: 12,
    trendDelta: 0,
    recentAvgDelta: 0,
    ...over,
  };
}

describe("lib/ai/risk/detect.ts", () => {
  describe("detectStudentRisks", () => {
    it("pas d'insight si tout va bien (score < 20)", () => {
      const input = makeInput({
        attendanceRatePct: 100,
        absenceRatePct: 0,
        currentAvg: 15,
        previousAvg: 15,
        classAvg: 15,
        lateCount: 0,
        lateDeltaPct: 0,
        lateRatePct: 0,
        trendDelta: 0,
        recentAvgDelta: 0,
      });
      const drafts = detectStudentRisks(input, "2025-01-01");
      expect(drafts.length).toBe(0);
    });

    it("génère attendance_risk si absentéisme élevé", () => {
      const input = makeInput({
        attendanceRatePct: 75,
        absenceRatePct: 25,
        currentAvg: 12,
        previousAvg: 12,
        classAvg: 12,
        lateCount: 0,
      });
      const drafts = detectStudentRisks(input, "2025-01-01");
      const att = drafts.find((d) => d.type === "attendance_risk");
      expect(att).toBeDefined();
      expect(att?.severity).toBe("medium");
    });

    it("génère performance_drop si chute > 1.5", () => {
      const input = makeInput({
        attendanceRatePct: 100,
        absenceRatePct: 0,
        currentAvg: 10,
        previousAvg: 14,
        classAvg: 12,
        trendDelta: -4,
        lateCount: 0,
      });
      const drafts = detectStudentRisks(input, "2025-01-01");
      const perf = drafts.find((d) => d.type === "performance_drop");
      expect(perf).toBeDefined();
    });

    it("génère positive_trend si amélioration > 1.2", () => {
      const input = makeInput({
        attendanceRatePct: 100,
        absenceRatePct: 0,
        currentAvg: 15,
        previousAvg: 12,
        classAvg: 12,
        trendDelta: 3,
        lateCount: 0,
      });
      const drafts = detectStudentRisks(input, "2025-01-01");
      const pos = drafts.find((d) => d.type === "positive_trend");
      expect(pos).toBeDefined();
      expect(pos?.severity).toBe("info");
    });

    it("génère attendance_drop si absentéisme récent élevé", () => {
      const input = makeInput({
        attendanceRatePct: 95,
        absenceRatePct: 5,
        currentAvg: 12,
        previousAvg: 12,
        classAvg: 12,
        recentAvgDelta: -2,
        lateCount: 0,
      });
      const drafts = detectStudentRisks(input, "2025-01-01");
      const attDrop = drafts.find((d) => d.type === "attendance_drop");
      expect(attDrop).toBeDefined();
    });

    it("génère performance_risk si en dessous moyenne classe de 1.5+", () => {
      const input = makeInput({
        attendanceRatePct: 100,
        absenceRatePct: 0,
        currentAvg: 8,
        previousAvg: 10,
        classAvg: 12,
        trendDelta: -2,
        lateCount: 0,
      });
      const drafts = detectStudentRisks(input, "2025-01-01");
      const perfRisk = drafts.find((d) => d.type === "performance_risk");
      expect(perfRisk).toBeDefined();
    });

    it("génère retards si latenessDelta > 50%", () => {
      const input = makeInput({
        attendanceRatePct: 100,
        absenceRatePct: 0,
        currentAvg: 12,
        previousAvg: 12,
        classAvg: 12,
        lateCount: 6,
        lateDeltaPct: 60,
        lateRatePct: 20,
      });
      const drafts = detectStudentRisks(input, "2025-01-01");
      const lateRisk = drafts.find((d) => d.type === "attendance_risk" && d.summary?.includes("retard"));
      // attendance_risk covers both absence and lateness
      expect(lateRisk).toBeDefined();
    });

    it("dedupKey unique par fenêtre et type", () => {
      const input = makeInput({ attendanceRatePct: 75, absenceRatePct: 25 });
      const drafts = detectStudentRisks(input, "2025-01-01");
      const keys = new Set(drafts.map((d) => d.dedupKey));
      expect(keys.size).toBe(drafts.length);
    });
  });

  describe("detectClassAnomaly", () => {
    it("retourne null si classe saine", () => {
      const res = detectClassAnomaly("sch-1", "cls-1", "6ème A", {
        attendanceRatePct: 95,
        average: 13,
      });
      expect(res).toBeNull();
    });

    it("retourne class_anomaly si présence < 85%", () => {
      const res = detectClassAnomaly("sch-1", "cls-1", "6ème A", {
        attendanceRatePct: 80,
        average: 13,
      });
      expect(res).not.toBeNull();
      expect(res?.type).toBe("class_anomaly");
    });

    it("retourne class_anomaly si moyenne < 10", () => {
      const res = detectClassAnomaly("sch-1", "cls-1", "6ème A", {
        attendanceRatePct: 95,
        average: 9,
      });
      expect(res).not.toBeNull();
      expect(res?.type).toBe("class_anomaly");
    });
  });
});