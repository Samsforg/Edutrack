import { describe, expect, it } from "vitest";
import {
  severityFor,
  absenceSubScore,
  performanceSubScore,
  latenessSubScore,
  recentSubScore,
  computeRisk,
  shouldGenerateNegativeInsight,
  formatAvg,
  isPositiveTrend,
  severityFromScore,
} from "@/lib/ai/risk/engine";
import { ATTENDANCE_THRESHOLDS } from "@/lib/ai/risk/config";
import type { StudentRiskInput, RiskResult } from "@/lib/ai/types";

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

describe("lib/ai/risk/engine.ts", () => {
  describe("severityFor", () => {
    it("mappe les scores aux bons niveaux de sévérité", () => {
      expect(severityFor(10, ATTENDANCE_THRESHOLDS)).toBe("info");
      expect(severityFor(30, ATTENDANCE_THRESHOLDS)).toBe("low");
      expect(severityFor(55, ATTENDANCE_THRESHOLDS)).toBe("medium");
      expect(severityFor(75, ATTENDANCE_THRESHOLDS)).toBe("high");
      expect(severityFor(90, ATTENDANCE_THRESHOLDS)).toBe("critical");
    });
  });

  describe("absenceSubScore", () => {
    it("0% absence = 0", () => {
      expect(absenceSubScore(0)).toBe(0);
    });
    it("5% absence = score faible", () => {
      const s = absenceSubScore(5);
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThanOrEqual(100);
    });
    it("20% absence = score élevé", () => {
      const s = absenceSubScore(20);
      expect(s).toBeGreaterThan(50);
    });
    it("50% absence = 75 (plafonné par la formule)", () => {
      expect(absenceSubScore(50)).toBe(75);
    });
  });

  describe("performanceSubScore", () => {
    it("pas de chute = 0", () => {
      expect(performanceSubScore(0)).toBe(0);
    });
    it("chute de 2 = score positif", () => {
      const s = performanceSubScore(2);
      expect(s).toBeGreaterThan(0);
    });
    it("plafonné à 100", () => {
      expect(performanceSubScore(20)).toBe(100);
    });
  });

  describe("latenessSubScore", () => {
    it("pas de retard = 0", () => {
      expect(latenessSubScore(0, 0)).toBe(0);
    });
    it("retard élevé (10) = score significatif", () => {
      const s = latenessSubScore(10, 20);
      expect(s).toBeGreaterThan(0);
    });
  });

  describe("recentSubScore", () => {
    it("tendance positive = 0", () => {
      expect(recentSubScore(1.2)).toBe(0);
    });
    it("tendance négative = 0 (seuil non atteint)", () => {
      const s = recentSubScore(0.8);
      expect(s).toBe(0);
    });
  });

  describe("computeRisk", () => {
    it("retourne score + sévérité + facteurs", () => {
      const res = computeRisk({
        absenceRatePct: 10,
        performanceDrop: 1.5,
        latenessCount: 5,
        latenessDeltaPct: 60,
        recentTrend: 0.8,
      });
      expect(res.score).toBeGreaterThanOrEqual(0);
      expect(res.score).toBeLessThanOrEqual(100);
      expect(["info", "low", "medium", "high", "critical"]).toContain(res.severity);
      expect(res.factors).toHaveProperty("attendance");
      expect(res.factors).toHaveProperty("performance");
      expect(res.factors).toHaveProperty("lateness");
      expect(res.factors).toHaveProperty("recent");
    });

    it("élève sans signaux = score bas", () => {
      const res = computeRisk({
        absenceRatePct: 0,
        performanceDrop: 0,
        latenessCount: 0,
        latenessDeltaPct: 0,
        recentTrend: 1.0,
      });
      expect(res.score).toBeLessThan(20);
    });

    it("élève avec tous signaux max = score significatif", () => {
      const res = computeRisk({
        absenceRatePct: 30,
        performanceDrop: 3,
        latenessCount: 20,
        latenessDeltaPct: 100,
        recentTrend: 0.5,
      });
      expect(res.score).toBeGreaterThan(20);
    });
  });

  describe("shouldGenerateNegativeInsight", () => {
    it("true si score >= 40", () => {
      const result: RiskResult = { score: 40, severity: "medium", factors: { attendance: 0, performance: 0, lateness: 0, recent: 0 }, reasons: [], recommendations: [] };
      expect(shouldGenerateNegativeInsight(result)).toBe(true);
      const result2: RiskResult = { score: 60, severity: "high", factors: { attendance: 0, performance: 0, lateness: 0, recent: 0 }, reasons: [], recommendations: [] };
      expect(shouldGenerateNegativeInsight(result2)).toBe(true);
    });
    it("false si score < 40", () => {
      const result: RiskResult = { score: 39, severity: "low", factors: { attendance: 0, performance: 0, lateness: 0, recent: 0 }, reasons: [], recommendations: [] };
      expect(shouldGenerateNegativeInsight(result)).toBe(false);
      const result2: RiskResult = { score: 20, severity: "info", factors: { attendance: 0, performance: 0, lateness: 0, recent: 0 }, reasons: [], recommendations: [] };
      expect(shouldGenerateNegativeInsight(result2)).toBe(false);
    });
  });

  describe("formatAvg", () => {
    it("formate correctement", () => {
      expect(formatAvg(null)).toBe("—");
      expect(formatAvg(12.5)).toBe("12,5");
      expect(formatAvg(10)).toBe("10,0");
    });
  });

  describe("trend / isPositiveTrend", () => {
    it("détecte amélioration", () => {
      const input = makeInput({ currentAvg: 15, previousAvg: 12 });
      expect(isPositiveTrend(input)).toBe(true);
    });
    it("détecte baisse", () => {
      const input = makeInput({ currentAvg: 10, previousAvg: 12 });
      expect(isPositiveTrend(input)).toBe(false);
    });
    it("stable = pas positive", () => {
      const input = makeInput({ currentAvg: 12, previousAvg: 12 });
      expect(isPositiveTrend(input)).toBe(false);
    });
  });

  describe("severityFromScore", () => {
    it("borne basse", () => {
      expect(severityFromScore(-1)).toBe("info");
    });
    it("borne haute", () => {
      expect(severityFromScore(101)).toBe("critical");
    });
  });

  describe("recommendations (via computeRisk)", () => {
    it("génère des recommandations si facteurs élevés", () => {
      const res = computeRisk({
        absenceRatePct: 30,
        performanceDrop: 2,
        latenessCount: 10,
        latenessDeltaPct: 60,
        recentTrend: 0.8,
      });
      expect(res.recommendations.length).toBeGreaterThan(0);
    });

    it("toujours au moins une recommandation (même si tout va bien)", () => {
      const res = computeRisk({
        absenceRatePct: 0,
        performanceDrop: 0,
        latenessCount: 0,
        latenessDeltaPct: 0,
        recentTrend: 1.0,
      });
      expect(res.recommendations.length).toBeGreaterThanOrEqual(1);
    });
  });
});