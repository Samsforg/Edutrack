import { z } from "zod";
import { StatisticalProvider } from "@/lib/ai/providers/statistical";
import { LLMProvider } from "@/lib/ai/providers/llm";
import type { AIProvider } from "@/lib/ai/providers/types";
import type { ClassSummary, StudentRiskInput, StudentSummary } from "@/lib/ai/types";
import type { ClassSummaryInput } from "@/lib/ai/providers/types";

/**
 * AI Gateway — point d'entrée unique du module IA.
 * Architecture : EduTrack -> AI Gateway -> AI Provider.
 * Le reste de l'application n'importe JAMAIS directement un provider.
 *
 * Sûreté : si le provider configuré échoue, on retombe sur le
 * StatisticalProvider (déterministe) => l'app ne bloque jamais (§50).
 */

function detectProvider(): AIProvider {
  const providerFromEnv = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (providerFromEnv && providerFromEnv !== "statistical") {
    const key = process.env.AI_API_KEY;
    if (key) {
      return new LLMProvider(providerFromEnv, key);
    }
  }
  return new StatisticalProvider();
}

const statistical = new StatisticalProvider();

export const aiGateway = {
  provider: <T extends AIProvider>(p: T) => p,

  /** Génère du texte via le provider courant (fallback statistique). */
  async generateText(input: { prompt: string; temperature?: number }): Promise<string> {
    try {
      return await detectProvider().generateText(input);
    } catch {
      return statistical.generateText(input);
    }
  },

  /** Génère une sortie structurée validée par Zod (fallback fourni). */
  async generateStructured<TZod extends z.ZodType>(
    input: { prompt: string; schema: TZod },
    fallback: z.infer<TZod>
  ): Promise<z.infer<TZod>> {
    try {
      return await detectProvider().generateStructured(input, fallback);
    } catch {
      return fallback;
    }
  },

  /** Génère un résumé d'élève ou de classe (Zod validé). */
  async generateSummary(
    kind: "student" | "class",
    data: StudentRiskInput | ClassSummaryInput
  ): Promise<StudentSummary | ClassSummary> {
    try {
      return await detectProvider().generateSummary({ kind, data });
    } catch {
      return statistical.generateSummary({ kind, data });
    }
  },

  /** Provider utilisé pour instrumentation/audit. */
  get currentName(): string {
    return detectProvider().name;
  },
};

// Ré-export du type du gateway pour cohérence.
export type { AIProvider };
export type { ClassSummaryInput };
