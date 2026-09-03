import { z } from "zod";

/**
 * Schémas Zod pour les sorties structurées de l'IA.
 * Toute réponse IA utilisée par l'application est validée avec ces schémas :
 * AI -> JSON -> Zod -> données valides (§57). Si la validation échoue,
 * on utilise un fallback (jamais le texte brut du modèle).
 */

export const StudentSummarySchema = z.object({
  overview: z.string(),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export const ClassSummarySchema = z.object({
  className: z.string(),
  attendanceRatePct: z.number().nullable(),
  average: z.number().nullable(),
  positives: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export const WeeklyDigestSchema = z.object({
  attendanceRatePct: z.number().nullable(),
  lateCount: z.number(),
  average: z.number().nullable(),
  progression: z.array(z.string()),
  toWatch: z.array(z.string()),
});

export type StudentSummaryData = z.infer<typeof StudentSummarySchema>;
export type ClassSummaryData = z.infer<typeof ClassSummarySchema>;
export type WeeklyDigestData = z.infer<typeof WeeklyDigestSchema>;
