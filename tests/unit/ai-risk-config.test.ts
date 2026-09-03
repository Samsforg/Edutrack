import { describe, expect, it } from "vitest";
import {
  RISK_WEIGHTS,
  ATTENDANCE_THRESHOLDS,
  LATE_DELTA_SIGNAL_PCT,
  LATE_COUNT_HIGH,
  PERFORMANCE_DROP_SIGNAL,
  PERFORMANCE_DROP_RECENT_SIGNAL,
  IMPROVEMENT_SIGNAL,
  BELOW_CLASS_AVG_THRESHOLD,
  ANALYSIS_WINDOW,
  INSIGHT_TTL_HOURS,
  DEDUP_TTL_HOURS,
  NEGATIVE_INSIGHT_MIN_SCORE,
  INFO_INSIGHT_MIN_SCORE,
  AI_QUOTAS,
  IMPORTANT_EVENT_LIMIT,
} from "@/lib/ai/risk/config";

describe("lib/ai/risk/config.ts", () => {
  it("pondérations du risque (40/30/20/10)", () => {
    expect(RISK_WEIGHTS.attendance).toBe(40);
    expect(RISK_WEIGHTS.performance).toBe(30);
    expect(RISK_WEIGHTS.lateness).toBe(20);
    expect(RISK_WEIGHTS.recent).toBe(10);
    const sum = RISK_WEIGHTS.attendance + RISK_WEIGHTS.performance + RISK_WEIGHTS.lateness + RISK_WEIGHTS.recent;
    expect(sum).toBe(100);
  });

  it("seuils d'assiduité (array SeverityBand: 0-4 faible, 5-9 modéré, 10-19 élevé, ≥20 critique)", () => {
    expect(ATTENDANCE_THRESHOLDS).toHaveLength(4);
    // critical
    expect(ATTENDANCE_THRESHOLDS[0].min).toBe(20);
    expect(ATTENDANCE_THRESHOLDS[0].severity).toBe("critical");
    // high
    expect(ATTENDANCE_THRESHOLDS[1].min).toBe(10);
    expect(ATTENDANCE_THRESHOLDS[1].severity).toBe("high");
    // medium
    expect(ATTENDANCE_THRESHOLDS[2].min).toBe(5);
    expect(ATTENDANCE_THRESHOLDS[2].severity).toBe("medium");
    // low
    expect(ATTENDANCE_THRESHOLDS[3].min).toBe(0);
    expect(ATTENDANCE_THRESHOLDS[3].severity).toBe("low");
  });

  it("fenêtres d'analyse correctes", () => {
    expect(ANALYSIS_WINDOW.attendanceDays).toBe(30);
    expect(ANALYSIS_WINDOW.attendanceRecentDays).toBe(10);
    expect(ANALYSIS_WINDOW.lateWindowDays).toBe(30);
    expect(ANALYSIS_WINDOW.gradeWindowDays).toBe(60);
  });

  it("durées de vie et déduplication", () => {
    expect(INSIGHT_TTL_HOURS).toBe(168);
    expect(DEDUP_TTL_HOURS).toBe(24);
  });

  it("seuils de génération d'insights", () => {
    expect(NEGATIVE_INSIGHT_MIN_SCORE).toBe(40);
    expect(INFO_INSIGHT_MIN_SCORE).toBe(20);
  });

  it("quotas par plan", () => {
    expect(AI_QUOTAS.starter.requestsPerMonth).toBe(200);
    expect(AI_QUOTAS.standard.requestsPerMonth).toBe(1000);
    expect(AI_QUOTAS.pro.requestsPerMonth).toBe(5000);
    expect(AI_QUOTAS.starter.summaries).toBe(false);
    expect(AI_QUOTAS.standard.summaries).toBe(true);
    expect(AI_QUOTAS.pro.assistant).toBe(true);
  });

  it("signaux de retard et performance", () => {
    expect(LATE_DELTA_SIGNAL_PCT).toBe(50);
    expect(LATE_COUNT_HIGH).toBe(5);
    expect(PERFORMANCE_DROP_SIGNAL).toBe(1.5);
    expect(PERFORMANCE_DROP_RECENT_SIGNAL).toBe(0.8);
    expect(IMPROVEMENT_SIGNAL).toBe(1.2);
    expect(BELOW_CLASS_AVG_THRESHOLD).toBe(1.5);
  });

  it("limite d'événements importants", () => {
    expect(IMPORTANT_EVENT_LIMIT).toBe(10);
  });
});