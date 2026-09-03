import type { AiInsightType, AiSeverity, AiInsightStatus } from "@/lib/ai/types";

/** Libellés français des types d'insights. */
export const INSIGHT_TYPE_LABELS: Record<AiInsightType, string> = {
  attendance_risk: "Risque d'assiduité",
  performance_risk: "Risque de performance",
  performance_drop: "Baisse de performance",
  attendance_drop: "Baisse d'assiduité",
  improvement: "Amélioration",
  positive_trend: "Progression",
  class_anomaly: "Anomalie de classe",
  school_anomaly: "Anomalie d'établissement",
};

export const SEVERITY_LABELS: Record<AiSeverity, string> = {
  info: "Info",
  low: "Faible",
  medium: "Moyen",
  high: "Élevé",
  critical: "Critique",
};

export const SEVERITY_BADGE: Record<AiSeverity, string> = {
  info: "bg-slate-500 text-white",
  low: "bg-sky-600 text-white",
  medium: "bg-amber-500 text-white",
  high: "bg-orange-600 text-white",
  critical: "bg-destructive text-white",
};

export const STATUS_LABELS: Record<AiInsightStatus, string> = {
  active: "Active",
  acknowledged: "Reconnue",
  resolved: "Résolue",
  dismissed: "Ignorée",
};

export const ROLLOUT_LABELS: Record<string, string> = {
  disabled: "Désactivé",
  internal: "Interne",
  pilot: "Pilote",
  beta: "Bêta",
  enabled: "Activé",
};
