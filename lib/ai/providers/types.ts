import { z } from "zod";
import type {
  ClassSummary,
  StudentSummary,
  StudentRiskInput,
} from "@/lib/ai/types";

/**
 * AIProvider — abstraction du fournisseur IA. Le reste de l'application
 * ne dépend jamais directement d'un fournisseur : il passe par l'AIGateway
 * (lib/ai/gateway.ts) qui choisit le provider selon la configuration.
 *
 * Toutes les sorties structurées sont validées par Zod avant utilisation.
 */

export type GenerateTextInput = { prompt: string; temperature?: number };

export type GenerateStructuredInput<TZod extends z.ZodType> = {
  prompt: string;
  schema: TZod;
};

export type GenerateSummaryInput = {
  kind: "student" | "class";
  data: StudentRiskInput | ClassSummaryInput;
};

export type ClassSummaryInput = {
  className: string;
  attendanceRatePct: number | null;
  average: number | null;
  top: string[];
  concerns: string[];
};

export interface AIProvider {
  readonly name: string;
  /** Génère du texte libre (fallback purement statistique par défaut). */
  generateText(input: GenerateTextInput): Promise<string>;
  /** Génère une sortie structurée validée par Zod. */
  generateStructured<TZod extends z.ZodType>(
    input: GenerateStructuredInput<TZod>,
    fallback: z.infer<TZod>
  ): Promise<z.infer<TZod>>;
  /** Génère un résumé d'élève ou de classe. */
  generateSummary(input: GenerateSummaryInput): Promise<StudentSummary | ClassSummary>;
}
