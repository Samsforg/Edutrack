import { z } from "zod";
import { StatisticalProvider } from "@/lib/ai/providers/statistical";
import type { AIProvider, ClassSummaryInput } from "@/lib/ai/providers/types";
import type { ClassSummary, StudentSummary, StudentRiskInput } from "@/lib/ai/types";

/**
 * LLMProvider — fournisseur LLM externe (optionnel).
 * N'est instancié que si le Gateway détecte un fournisseur configuré
 * (env AI_PROVIDER + clé AI_API_KEY). En son absence, StatisticalProvider
 * est utilisé -> l'application ne dépend jamais d'un modèle externe (§50).
 *
 * Anti-surgéniérie : pas de SDK lourd, le contrat est documenté et on
 * garde le fallback statistique si le provider est down.
 */
export class LLMProvider implements AIProvider {
  readonly name: string;
  private readonly statistical = new StatisticalProvider();

  constructor(
    name: string,
    private apiKey: string | undefined
  ) {
    this.name = name;
    void this.apiKey;
  }

  async generateText(input: { prompt: string; temperature?: number }): Promise<string> {
    void input;
    // Provider externe non réellement câblé : on retombe sur le fallback.
    throw new Error("LLMProvider non configuré.");
  }

  async generateStructured<TZod extends z.ZodType>(
    input: { prompt: string; schema: TZod },
    fallback: z.infer<TZod>
  ): Promise<z.infer<TZod>> {
    void input;
    return fallback;
  }

  async generateSummary(
    input: { kind: "student" | "class"; data: StudentRiskInput | ClassSummaryInput }
  ): Promise<StudentSummary | ClassSummary> {
    void input;
    return this.statistical.generateSummary(input);
  }
}
