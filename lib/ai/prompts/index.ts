/**
 * Prompts du module IA EduTrack.
 *
 * Chaque prompt précise : rôle, données disponibles, données interdites,
 * format, contraintes et langue (français). Ces prompts sont destinés aux
 * fournisseurs LLM ; le StatisticalProvider ne les utilise pas (il reste
 * 100 % déterministe), mais ils définissent le contrat en cas de provider LLM.
 */

import type { StudentRiskInput } from "@/lib/ai/types";

const FRENCH_RULE =
  "Rédige UNIQUEMENT en français. Évite le jargon technique. Ne fais aucune déclaration médicale. Ne prédis jamais l'avenir de façon définitive.";

const FORBIDDEN_RULE =
  "Ne réponds qu'à partir des données fournies. N'invente jamais une information absente. Ne révèle pas de données d'autres élèves/enfants.";

function riskFacts(input: StudentRiskInput): string {
  return [
    `Taux d'absence: ${input.absenceRatePct.toFixed(1)}%`,
    `Retards: ${input.lateCount}`,
    `Moyenne actuelle (/20): ${input.currentAvg ?? "n/a"}`,
    `Moyenne précédente (/20): ${input.previousAvg ?? "n/a"}`,
    `Moyenne de classe (/20): ${input.classAvg ?? "n/a"}`,
  ].join("\n");
}

export function buildStudentSummaryPrompt(input: StudentRiskInput): string {
  return [
    `Rôle: assistant de suivi scolaire (nourris des données fournies).`,
    FRENCH_RULE,
    FORBIDDEN_RULE,
    `Données disponibles:\n${riskFacts(input)}`,
    `Format de sortie (JSON uniquement):`,
    `{ "overview": string, "strengths": string[], "concerns": string[], "recommendations": string[] }`,
  ].join("\n");
}

export function buildClassSummaryPrompt(input: {
  className: string;
  attendanceRatePct: number | null;
  average: number | null;
  top: string[];
  concerns: string[];
}): string {
  return [
    `Rôle: assistant de suivi scolaire d'une classe.`,
    FRENCH_RULE,
    FORBIDDEN_RULE,
    `Classe: ${input.className}`,
    `Présence: ${input.attendanceRatePct ?? "n/a"}%`,
    `Moyenne: ${input.average ?? "n/a"}/20`,
    `Points pos:\n${input.top.join("\n")}`,
    `Points d'attention:\n${input.concerns.join("\n")}`,
    `Format de sortie (JSON): { "positives": string[], "concerns": string[], "recommendations": string[] }`,
  ].join("\n");
}

export function buildRiskExplanationPrompt(
  evidence: Record<string, unknown>,
  recommendation: string
): string {
  return [
    `Rôle: expliquer un risque scolaire détecté à un adulte.`,
    FRENCH_RULE,
    FORBIDDEN_RULE,
    "Les indicateurs actuels montrent (jamais « l'IA pense que l'élève va échouer ») :",
    `Preuves:\n${JSON.stringify(evidence, null, 2)}`,
    `Recommandation: ${recommendation}`,
    `Rédige une explication courte et factuelle.`,
  ].join("\n");
}

export function buildParentInsightPrompt(
  childName: string,
  data: StudentRiskInput
): string {
  return [
    `Rôle: information parentale sur la situation scolaire de ${childName}.`,
    FRENCH_RULE,
    FORBIDDEN_RULE,
    `Données:\n${riskFacts(data)}`,
    "Donne uniquement des conseils généraux (non médicaux).",
    `Ex: « La présence récente montre une baisse. Il peut être utile d'échanger avec l'enfant et l'établissement. »`,
  ].join("\n");
}

export function buildTeacherInsightPrompt(
  className: string,
  students: { name: string; note: string }[]
): string {
  return [
    `Rôle: synthèse pour un enseignant de la classe ${className}.`,
    FRENCH_RULE,
    FORBIDDEN_RULE,
    `Élèves (nom + note):\n${students.map((s) => `- ${s.name}: ${s.note}`).join("\n")}`,
    `Classes autorisées: uniquement ${className}. Ne révèle aucune autre classe.`,
    `Résume les élèves à surveiller, en progression et les matières nécessitant attention.`,
  ].join("\n");
}

export function buildAssistantPrompt(
  role: "SCHOOL_ADMIN" | "TEACHER" | "PARENT" | "SUPER_ADMIN",
  question: string,
  context: string
): string {
  const scopeByRole: Record<string, string> = {
    SCHOOL_ADMIN: "ta propre école",
    TEACHER: "tes propres classes et élèves",
    PARENT: "uniquement tes propres enfants",
    SUPER_ADMIN: "les données auxquelles tu as accès",
  };
  return [
    `Rôle: assistant EduTrack pour un ${role}.`,
    FRENCH_RULE,
    FORBIDDEN_RULE,
    `Périmètre autorisé: ${scopeByRole[role]}.`,
    `Contexte (déjà filtré côté serveur):\n${context}`,
    `Question de l'utilisateur:\n${question}`,
    "Réponds uniquement à partir du contexte fourni.",
  ].join("\n");
}
