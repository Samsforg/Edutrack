import {
  DEDUP_TTL_HOURS,
  INSIGHT_TTL_HOURS,
  PERFORMANCE_DROP_RECENT_SIGNAL,
  PERFORMANCE_DROP_SIGNAL,
} from "@/lib/ai/risk/config";
import {
  computeRisk,
  formatAvg,
  isPositiveTrend,
  shouldGenerateNegativeInsight,
} from "@/lib/ai/risk/engine";
import { IMPROVEMENT_SIGNAL } from "@/lib/ai/risk/config";
import type {
  AiInsight,
  AiInsightType,
  StudentRiskInput,
} from "@/lib/ai/types";

export type InsightDraft = {
  type: AiInsightType;
  severity: AiInsight["severity"];
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  recommendation: string;
  confidence: number;
  dedupKey: string;
  className?: string | null;
};

function buildDedupKey(
  schoolId: string,
  studentId: string | null,
  classId: string | null,
  type: AiInsightType,
  windowStart: string
): string {
  return `${schoolId}|${studentId ?? "-"}|${classId ?? "-"}|${type}|${windowStart}`;
}

function isoHours(hours: number): string {
  return new Date(Date.now() + hours * 3600000).toISOString();
}

/** Génère les insights négatifs/progressions pour un élève (déterministe). */
export function detectStudentRisks(
  input: StudentRiskInput,
  currentPeriodStart: string
): InsightDraft[] {
  const drafts: InsightDraft[] = [];
  const name = input.className ? `en ${input.className}` : "";
  const risk = computeRisk(input);

  // --- Positive trend ---
  if (isPositiveTrend(input) && input.currentAvg != null && input.previousAvg != null) {
    drafts.push({
      type: "positive_trend",
      severity: "info",
      title: "Bonne progression",
      summary: `La moyenne de l'élève est passée de ${formatAvg(
        input.previousAvg
      )} à ${formatAvg(input.currentAvg)}.`,
      evidence: {
        previous_avg: input.previousAvg,
        current_avg: input.currentAvg,
        delta: +(input.currentAvg - input.previousAvg).toFixed(2),
      },
      recommendation: "Encourager l'élève et reproduire les méthodes qui fonctionnent.",
      confidence: 90,
      dedupKey: buildDedupKey(input.schoolId, input.studentId, null, "positive_trend", currentPeriodStart),
      className: input.className,
    });
  }

  // --- Attendance risk ---
  if (input.absenceRatePct >= 5) {
    drafts.push({
      type: "attendance_risk",
      severity: "medium",
      title: "Présence à surveiller",
      summary: `${Math.round(input.absenceRatePct)}% de taux d'absence récent${name ? ` ${name}` : ""}.`,
      evidence: {
        absence_rate_pct: +input.absenceRatePct.toFixed(1),
        late_count: input.lateCount,
      },
      recommendation:
        "Échanger avec le parent pour comprendre les absences et vérifier les difficultés rencontrées.",
      confidence: 85,
      dedupKey: buildDedupKey(input.schoolId, input.studentId, null, "attendance_risk", currentPeriodStart),
      className: input.className,
    });
  }

  // --- Performance drop (global + récente) ---
  const hasDrop =
    input.trendDelta != null && input.trendDelta <= -PERFORMANCE_DROP_SIGNAL;
  const hasRecentDrop =
    input.recentAvgDelta != null && input.recentAvgDelta <= -PERFORMANCE_DROP_RECENT_SIGNAL;
  if (hasDrop || hasRecentDrop) {
    const type: AiInsightType =
      input.recentAvgDelta != null && input.recentAvgDelta <= -PERFORMANCE_DROP_RECENT_SIGNAL
        ? "attendance_drop"
        : "performance_drop";
    const severity = "high";
    const base = `La moyenne de l'élève ${input.previousAvg != null ? `est passée de ${formatAvg(input.previousAvg)} à ${formatAvg(input.currentAvg)}` : "est en baisse"}.`;
    drafts.push({
      type,
      severity,
      title: "Baisse des performances",
      summary: `${base}${name ? ` (${name})` : ""}.`,
      evidence: {
        previous_avg: input.previousAvg,
        current_avg: input.currentAvg,
        class_avg: input.classAvg,
        trend_delta: input.trendDelta,
        recent_delta: input.recentAvgDelta,
      },
      recommendation:
        "Revoir les dernières évaluations de l'élève pour identifier les matières en baisse et proposer un accompagnement.",
      confidence: 80,
      dedupKey: buildDedupKey(input.schoolId, input.studentId, null, type, currentPeriodStart),
      className: input.className,
    });
    return drafts;
  }

  // --- Risk global (uniquement si un score significatif, sinon aucun spam) ---
  if (shouldGenerateNegativeInsight(risk)) {
    drafts.push({
      type: "performance_risk",
      severity: risk.severity,
      title: "Élève nécessitant une attention",
      summary: risk.reasons.join(" "),
      evidence: {
        score: +risk.score.toFixed(1),
        factors: risk.factors,
      },
      recommendation: risk.recommendations[0] ?? "Maintenir le suivi de l'élève.",
      confidence: 75,
      dedupKey: buildDedupKey(input.schoolId, input.studentId, null, "performance_risk", currentPeriodStart),
      className: input.className,
    });
  }

  return drafts;
}

/** Génère un insight de classe (anomalie : moyenne ou présence sous le niveau). */
export function detectClassAnomaly(
  schoolId: string,
  classId: string,
  className: string,
  data: { attendanceRatePct: number | null; average: number | null; avgTarget?: number }
): InsightDraft | null {
  const anomalies: string[] = [];
  if (data.attendanceRatePct != null && data.attendanceRatePct < 85) {
    anomalies.push(`taux de présence de ${Math.round(data.attendanceRatePct)}%`);
  }
  if (data.average != null && data.average < 10) {
    anomalies.push(`moyenne de ${formatAvg(data.average)}/20`);
  }
  if (anomalies.length === 0) return null;

  return {
    type: "class_anomaly",
    severity: "medium",
    title: `Classe ${className} à surveiller`,
    summary: anomalySentence(className, anomalies),
    evidence: {
      attendance_rate_pct: data.attendanceRatePct,
      average: data.average,
    },
    recommendation:
      "Analyser les causes (présence, difficultés pédagogiques) et mettre en place un plan d'action.",
    confidence: 70,
    dedupKey: buildDedupKey(schoolId, null, classId, "class_anomaly", "day"),
    className,
  };
}

function anomalySentence(className: string, anomalies: string[]): string {
  const joined = anomalies.join(" et ");
  return `La classe ${className} présente ${joined} récemment.`;
}

export { IMPROVEMENT_SIGNAL };

/** Durée de vie d'un insight (heures). */
export function insightExpiryHours(): number {
  return DEDUP_TTL_HOURS + (INSIGHT_TTL_HOURS - DEDUP_TTL_HOURS);
}
