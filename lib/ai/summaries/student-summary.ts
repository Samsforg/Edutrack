import { z } from "zod";
import { aiGateway } from "@/lib/ai/provider";
import { StudentSummarySchema } from "@/lib/ai/schemas";
import { recordAiAudit, bumpAiUsage } from "@/lib/ai/store";
import type { StudentSummary, StudentRiskInput } from "@/lib/ai/types";

type GenerateOptions = {
  schoolId: string;
  userId?: string | null;
  model?: string | null;
};

/**
 * Génère un résumé structuré d'un élève (Zod validé §57).
 * Entrées : présence, retards, notes, évolution, période.
 * Sortie : { overview, strengths, concerns, recommendations }.
 */
export async function generateStudentSummary(
  data: StudentRiskInput,
  opts: GenerateOptions
): Promise<StudentSummary> {
  const started = Date.now();
  const fallback: StudentSummary = await aiGateway.generateSummary("student", data) as StudentSummary;

  // Jetons/usage (fallback statistique => 0 token, mais on compte la requête).
  try {
    await Promise.all([
      bumpAiUsage(opts.schoolId, { requests: 1, summaries: 1 }),
      recordAiAudit({
        schoolId: opts.schoolId,
        userId: opts.userId ?? null,
        action: "ai.summary.student",
        model: opts.model ?? aiGateway.currentName,
        inputType: "student_risk",
        outputType: "student_summary",
        latencyMs: Date.now() - started,
        tokensUsed: null,
      }),
    ]);
  } catch {
    // audit/usage non bloquant
  }

  // Validation Zod : si la sortie du fournisseur ne passe pas, on garde le
  // fallback, on ne fait JAMAIS confiance au texte brut du modèle.
  const parsed = StudentSummarySchema.safeParse(fallback);
  return parsed.success ? (parsed.data as StudentSummary) : fallback;
}

// Ré-export du schéma pour les consommateurs.
export { StudentSummarySchema as zStudentSummarySchema };
export const studentSummarySchema: z.ZodType<StudentSummary> = StudentSummarySchema;
