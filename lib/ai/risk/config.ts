import type { AiQuotaByPlan, SeverityBand } from "@/lib/ai/types";

/**
 * Configuration centralisée du Risk Engine (coefficients, seuils).
 * Tout est déterministe et explique les scores.
 */

/** Poids des facteurs dans le score global (somme = 100). */
export const RISK_WEIGHTS = {
  attendance: 40,
  performance: 30,
  lateness: 20,
  recent: 10,
} as const;

/**
 * Seuils d'absentéisme (V1).
 * 0-4% faible, 5-9% modéré, 10-19% élevé, >=20% critique.
 */
export const ATTENDANCE_THRESHOLDS: SeverityBand[] = [
  { min: 20, max: 100, severity: "critical" },
  { min: 10, max: 19.99, severity: "high" },
  { min: 5, max: 9.99, severity: "medium" },
  { min: 0, max: 4.99, severity: "low" },
];

export const LATE_DELTA_SIGNAL_PCT = 50; // +50% de retards => signal
export const LATE_COUNT_HIGH = 5; // >5 retards sur la fenêtre => signal fort

/** Baisse de moyenne jugée importante (en points /20). */
export const PERFORMANCE_DROP_SIGNAL = 1.5;
/** Baisse récente /20 jugée notable. */
export const PERFORMANCE_DROP_RECENT_SIGNAL = 0.8;

/** Progression /20 jugée significative (positive_trend). */
export const IMPROVEMENT_SIGNAL = 1.2;

/** Décalage sous la moyenne de classe (en points, sous la moyenne = +risque). */
export const BELOW_CLASS_AVG_THRESHOLD = 1.5;

/** Fenêtres d'analyse par défaut (jours). */
export const ANALYSIS_WINDOW = {
  attendanceDays: 30,
  attendanceRecentDays: 10,
  lateWindowDays: 30,
  gradeWindowDays: 60,
  trendPeriod: "previous_period" as const,
};

/** Durée de vie d'un insight (heures) avant dévalidation. */
export const INSIGHT_TTL_HOURS = 168; // 7 jours
/** Durée de déduplication (heures) pour éviter les alertes répétitives. */
export const DEDUP_TTL_HOURS = 24;

/** Seuil de score au-delà duquel on génère un insight négatif. */
export const NEGATIVE_INSIGHT_MIN_SCORE = 40;
/** Seuil de score minimal (info) pour signaler un risque faible. */
export const INFO_INSIGHT_MIN_SCORE = 20;

/** Quotas IA par plan (V1). */
export const AI_QUOTAS: AiQuotaByPlan = {
  starter: {
    insights: true,
    summaries: false,
    assistant: false,
    requestsPerMonth: 200,
  },
  standard: {
    insights: true,
    summaries: true,
    assistant: true,
    requestsPerMonth: 1000,
  },
  pro: {
    insights: true,
    summaries: true,
    assistant: true,
    requestsPerMonth: 5000,
  },
};

/** Limite de retards considérée comme « importante » pour un signal. */
export const IMPORTANT_EVENT_LIMIT = 10;
