import type { PlanCode } from "@/lib/billing/plans";

/** Types du moteur d'intelligence EduTrack (Phase 8). */

export type AiInsightType =
  | "attendance_risk"
  | "performance_risk"
  | "performance_drop"
  | "attendance_drop"
  | "improvement"
  | "positive_trend"
  | "class_anomaly"
  | "school_anomaly";

export type AiSeverity = "info" | "low" | "medium" | "high" | "critical";
export type AiInsightStatus = "active" | "acknowledged" | "resolved" | "dismissed";

export type AiInsight = {
  id: string;
  schoolId: string;
  studentId: string | null;
  classId: string | null;
  type: AiInsightType;
  severity: AiSeverity;
  title: string;
  summary: string | null;
  evidence: Record<string, unknown>;
  recommendation: string | null;
  confidence: number;
  status: AiInsightStatus;
  dedupKey: string;
  generatedAt: string;
  expiresAt: string | null;
  createdAt: string;
};

/** Donnée d'entrée minimale pour le calcul d'un score de risque élève. */
export type StudentRiskInput = {
  schoolId: string;
  studentId: string;
  className?: string | null;
  attendanceRatePct: number; // % de présence (absent non compté)
  absenceRatePct: number; // % d'absences
  lateCount: number; // retards sur la fenêtre
  lateDeltaPct: number; // évolution des retards (%)
  currentAvg: number | null; // moyenne actuelle /20
  previousAvg: number | null; // moyenne période précédente /20
  classAvg: number | null; // moyenne de la classe; /20
  trendDelta: number | null; // évolution globale /20 (current - previous)
  recentAvgDelta: number | null; // évolution récente /20
};

export type RiskFactors = {
  attendance: number; // 0..100 (contribution absences)
  performance: number; // 0..100
  lateness: number; // 0..100
  recent: number; // 0..100
};

export type RiskResult = {
  score: number; // 0..100 (moyenne pondérée)
  severity: AiSeverity;
  factors: RiskFactors;
  reasons: string[];
  recommendations: string[];
};

/** Distribution de sévérité pour un score 0..100. */
export type SeverityBand = { min: number; max: number; severity: AiSeverity };

/** Évolution (tendance) d'une métrique. */
export type Trend = "up" | "down" | "flat";

/** Résumé structuré produit par l'AIGateway (validé par Zod). */
export type StudentSummary = {
  overview: string;
  strengths: string[];
  concerns: string[];
  recommendations: string[];
};

export type ClassSummary = {
  className: string;
  attendanceRatePct: number | null;
  average: number | null;
  positives: string[];
  concerns: string[];
  recommendations: string[];
};

/** Feature flags (rollout). */
export type RolloutLevel = "disabled" | "internal" | "pilot" | "beta" | "enabled";

export type FeatureFlagKey =
  | "ai_insights"
  | "ai_assistant"
  | "ai_summaries"
  | "semantic_search"
  | "sms"
  | "whatsapp"
  | "weekly_digest";

/** Quotas IA par plan (V1 simple, basé sur PlanCode). */
export type AiQuotaPlan = {
  insights: boolean;
  summaries: boolean;
  assistant: boolean;
  requestsPerMonth: number;
};

export type AiQuotaByPlan = Record<PlanCode, AiQuotaPlan>;

/** Compteur d'usage IA d'une école. */
export type AiUsage = {
  requestsDay: number;
  requestsMonth: number;
  summaries: number;
  insights: number;
  tokensUsed: number;
};

/** Préférences de communication. */
export type CommunicationPreferences = {
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
};

/** Audit d'un appel IA. */
export type AiAuditEntry = {
  schoolId: string | null;
  userId: string | null;
  action: string;
  model: string | null;
  inputType: string | null;
  outputType: string | null;
  latencyMs: number | null;
  tokensUsed: number | null;
};
