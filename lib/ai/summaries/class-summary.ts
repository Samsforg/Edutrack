import { z } from "zod";
import { aiGateway } from "@/lib/ai/provider";
import { ClassSummarySchema } from "@/lib/ai/schemas";
import { recordAiAudit, bumpAiUsage } from "@/lib/ai/store";
import type { AIProvider } from "@/lib/ai/providers/types";
import type { ClassSummary as ClassSummaryType } from "@/lib/ai/types";

type ClassSummaryInput = Parameters<AIProvider["generateSummary"]>[0]["data"] & {
  className: string;
};

type GenerateOptions = {
  schoolId: string;
  userId?: string | null;
  model?: string | null;
};

/**
 * Génère un résumé structuré d'une classe (Zod validé §57).
 * Ex : Classe 3e A — Présence 94%, Moyenne 11,8/20 + points positifs/attention.
 */
export async function generateClassSummary(
  data: ClassSummaryInput,
  opts: GenerateOptions
): Promise<ClassSummaryType> {
  const started = Date.now();
  const fallback = (await aiGateway.generateSummary("class", data)) as ClassSummaryType;

  try {
    await Promise.all([
      bumpAiUsage(opts.schoolId, { requests: 1, summaries: 1 }),
      recordAiAudit({
        schoolId: opts.schoolId,
        userId: opts.userId ?? null,
        action: "ai.summary.class",
        model: opts.model ?? aiGateway.currentName,
        inputType: "class_stats",
        outputType: "class_summary",
        latencyMs: Date.now() - started,
        tokensUsed: null,
      }),
    ]);
  } catch {
    // non bloquant
  }

  const parsed = ClassSummarySchema.safeParse(fallback);
  return parsed.success ? (parsed.data as ClassSummaryType) : fallback;
}

export const classSummarySchema: z.ZodType<ClassSummaryType> = ClassSummarySchema;
