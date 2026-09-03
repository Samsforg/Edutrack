import {
  ATTENDANCE_THRESHOLDS,
  BELOW_CLASS_AVG_THRESHOLD,
  IMPORTANT_EVENT_LIMIT,
  IMPROVEMENT_SIGNAL,
  LATE_COUNT_HIGH,
  LATE_DELTA_SIGNAL_PCT,
  NEGATIVE_INSIGHT_MIN_SCORE,
  PERFORMANCE_DROP_RECENT_SIGNAL,
  PERFORMANCE_DROP_SIGNAL,
  RISK_WEIGHTS,
} from "@/lib/ai/risk/config";
import type {
  AiSeverity,
  RiskFactors,
  RiskResult,
  SeverityBand,
  StudentRiskInput,
  Trend,
} from "@/lib/ai/types";

/** Retourne la sévérité associée à un pourcentage selon les seuils fournis. */
export function severityFor(value: number, bands: SeverityBand[]): AiSeverity {
  const band = bands.find((b) => value >= b.min && value <= b.max);
  return band?.severity ?? "info";
}

/** Sous-score 0..100 à partir d'un taux d'absence (%).
 * 0 absent → 0 ; 100% absent → 100. */
export function absenceSubScore(absenceRatePct: number): number {
  const capped = Math.max(0, Math.min(100, absenceRatePct));
  // rate 0..20 => 0..60 ; 20..100 => 60..100
  if (capped <= 20) return (capped / 20) * 60;
  return 60 + ((capped - 20) / 80) * 40;
}

/** Sous-score performance 0..100 à partir de la moyenne /20.
 * avg=12 => 0 ; avg=8 => ~50 ; avg=4 => ~90. */
export function performanceSubScore(avg: number | null): number {
  if (avg == null) return 0;
  // baseline 12/20 = neutre, chaque point sous = +12.5
  const diff = 12 - avg;
  return Math.max(0, Math.min(100, diff * 12.5));
}

/** Sous-score retards 0..100. */
export function latenessSubScore(lateCount: number, lateDeltaPct: number): number {
  let score = 0;
  if (lateCount > 0) score += Math.min(40, lateCount * 8);
  if (lateDeltaPct >= LATE_DELTA_SIGNAL_PCT) score += 30;
  if (lateCount > LATE_COUNT_HIGH) score += 30;
  return Math.min(100, score);
}

/** Sous-score évolution récente /20. */
export function recentSubScore(recentAvgDelta: number | null): number {
  if (recentAvgDelta == null) return 0;
  return Math.max(0, Math.min(100, -recentAvgDelta * 15));
}

function severityFromScore(score: number): AiSeverity {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  if (score >= 20) return "low";
  return "info";
}

function sumFactors(f: RiskFactors): number {
  const totalWeight = Object.values(RISK_WEIGHTS).reduce((a, b) => a + b, 0);
  return (
    (f.attendance * RISK_WEIGHTS.attendance +
      f.performance * RISK_WEIGHTS.performance +
      f.lateness * RISK_WEIGHTS.lateness +
      f.recent * RISK_WEIGHTS.recent) /
    totalWeight
  );
}

/** Calcule le score de risque global explicable pour un élève. */
export function computeRisk(input: StudentRiskInput): RiskResult {
  const factors: RiskFactors = {
    attendance: absenceSubScore(input.absenceRatePct),
    performance: performanceSubScore(input.currentAvg),
    lateness: latenessSubScore(input.lateCount, input.lateDeltaPct),
    recent: recentSubScore(input.recentAvgDelta),
  };
  const score = sumFactors(factors);
  const severity = severityFromScore(score);

  const reasons: string[] = [];
  if (input.absenceRatePct >= 5) {
    reasons.push(
      `${Math.round(input.absenceRatePct)}% de taux d'absence récent.`
    );
  }
  if (input.currentAvg != null && input.previousAvg != null) {
    const delta = input.currentAvg - input.previousAvg;
    if (delta <= -PERFORMANCE_DROP_SIGNAL) {
      reasons.push(
        `La moyenne est passée de ${formatAvg(input.previousAvg)} à ${formatAvg(
          input.currentAvg
        )} (${delta.toFixed(1)} pts).`
      );
    }
  }
  if (input.classAvg != null && input.currentAvg != null) {
    if (input.currentAvg < input.classAvg - BELOW_CLASS_AVG_THRESHOLD) {
      reasons.push(
        `Moyenne ${formatAvg(input.currentAvg)} sous la moyenne de classe (${formatAvg(
          input.classAvg
        )}).`
      );
    }
  }
  if (input.lateCount >= IMPORTANT_EVENT_LIMIT) {
    reasons.push(`${input.lateCount} retards sur la période.`);
  }
  if (reasons.length === 0) {
    reasons.push("Les indicateurs actuels restent dans la normale.");
  }

  const recommendations = buildRecommendations(input, reasons);

  return { score, severity, factors, reasons, recommendations };
}

/** Transformation : renvoie un score poussé vers 0 si aucun vrai signal. */
export function shouldGenerateNegativeInsight(result: RiskResult): boolean {
  return result.score >= NEGATIVE_INSIGHT_MIN_SCORE;
}

function buildRecommendations(
  input: StudentRiskInput,
  reasons: string[]
): string[] {
  const recs: string[] = [];
  if (input.absenceRatePct >= 5) {
    recs.push(
      "Échanger avec le parent pour comprendre les absences et vérifier les difficultés rencontrées."
    );
  }
  if (input.currentAvg != null) {
    if (input.previousAvg != null && input.currentAvg < input.previousAvg - 1) {
      recs.push(
        "Revoir les dernières évaluations de l'élève pour identifier les matières en baisse."
      );
    }
    if (input.classAvg != null && input.currentAvg < input.classAvg - 1) {
      recs.push(
        "Proposer un accompagnement ciblé pour revenir au niveau de la classe."
      );
    }
  }
  if (input.lateCount >= IMPORTANT_EVENT_LIMIT) {
    recs.push(
      "Sensibiliser la famille à l'importance de la ponctualité et suivre l'évolution."
    );
  }
  if (recs.length === 0) {
    recs.push("Maintenir le suivi régulier des indicateurs de l'élève.");
  }
  return recs;
}

export function formatAvg(v: number | null): string {
  return v == null ? "—" : v.toFixed(1).replace(".", ",");
}

/** Tendance d'une métrique entre deux valeurs. */
export function trend(current: number | null, previous: number | null): Trend {
  if (current == null || previous == null) return "flat";
  const diff = current - previous;
  if (diff > 0.05) return "up";
  if (diff < -0.05) return "down";
  return "flat";
}

/** Détection d'une amélioration significative. */
export function isPositiveTrend(input: StudentRiskInput): boolean {
  if (input.currentAvg == null || input.previousAvg == null) return false;
  return input.currentAvg - input.previousAvg >= IMPROVEMENT_SIGNAL;
}

export { severityFromScore };
