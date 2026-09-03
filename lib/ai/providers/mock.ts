import { z } from "zod";
import { StatisticalProvider } from "@/lib/ai/providers/statistical";
import type { AIProvider, GenerateTextInput } from "@/lib/ai/providers/types";

/**
 * MockProvider — fournisseur de test : retourne des valeurs
 * déterministes, sans aucun appel externe. Utilisé par les tests
 * unitaires pour ne jamais dépendre d'un modèle (§41).
 */
export class MockProvider extends StatisticalProvider implements AIProvider {
  readonly name = "mock";

  override async generateText(input: GenerateTextInput): Promise<string> {
    return `[mock] ${input.prompt.slice(0, 20)}…`;
  }

  override async generateStructured<TZod extends z.ZodType>(
    input: { prompt: string; schema: TZod },
    fallback: z.infer<TZod>
  ): Promise<z.infer<TZod>> {
    void input;
    return fallback;
  }
}
