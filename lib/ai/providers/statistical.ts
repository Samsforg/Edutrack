import { z } from "zod";
import { computeRisk, formatAvg } from "@/lib/ai/risk/engine";
import { PERFORMANCE_DROP_SIGNAL, IMPROVEMENT_SIGNAL } from "@/lib/ai/risk/config";
import type { AIProvider } from "@/lib/ai/providers/types";
import type { ClassSummaryInput } from "@/lib/ai/providers/types";
import type { ClassSummary, StudentSummary, StudentRiskInput } from "@/lib/ai/types";

/**
 * StatisticalProvider — fournisseur IA par défaut, 100 % déterministe.
 * Il ne fait appel à aucun modèle externe : il transforme les statistiques
 * du Risk Engine en synthèses en français. Garantit que l'application
 * fonctionne même sans fournisseur LLM configuré (fallback §50).
 */
export class StatisticalProvider implements AIProvider {
  readonly name: string = "statistical";

  async generateText(input: { prompt: string; temperature?: number }): Promise<string> {
    void input;
    return "Synthèse non disponible. Utiliser la synthèse statistique.";
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
    if (input.kind === "class") {
      return this.classSummary(input.data as ClassSummaryInput);
    }
    return this.studentSummary(input.data as StudentRiskInput);
  }

  private studentSummary(input: StudentRiskInput): StudentSummary {
    const risk = computeRisk(input);
    const strengths: string[] = [];
    const concerns: string[] = [];
    const recommendations: string[] = risk.recommendations.slice();

    if (input.currentAvg != null && input.previousAvg != null) {
      if (input.currentAvg - input.previousAvg >= IMPROVEMENT_SIGNAL) {
        strengths.push(
          `La moyenne a progressé de ${formatAvg(input.previousAvg)} à ${formatAvg(
            input.currentAvg
          )}.`
        );
      } else if (input.currentAvg - input.previousAvg <= -PERFORMANCE_DROP_SIGNAL) {
        concerns.push(
          `La moyenne a baissé de ${formatAvg(input.previousAvg)} à ${formatAvg(
            input.currentAvg
          )}.`
        );
      }
    }
    if (input.absenceRatePct >= 5) {
      concerns.push(
        `${Math.round(input.absenceRatePct)}% de taux d'absence sur la période.`
      );
    }
    if (input.lateCount > 0) {
      concerns.push(`${input.lateCount} retard(s) relevé(s) sur la période.`);
    }
    if (strengths.length === 0) {
      strengths.push("Les indicateurs restent dans une évolution normale.");
    }
    if (concerns.length === 0) {
      concerns.push("Aucun point d'attention majeur détecté actuellement.");
    }

    const overview =
      input.currentAvg != null
        ? `L'élève présente une moyenne de ${formatAvg(input.currentAvg)}/20${input.classAvg != null ? ` (moyenne de classe ${formatAvg(input.classAvg)})` : ""}.`
        : "Peu de données de performance disponibles pour l'instant.";

    return { overview, strengths, concerns, recommendations };
  }

  private classSummary(input: ClassSummaryInput): ClassSummary {
    const positives = input.top.length > 0 ? input.top : ["Le niveau global reste stable."];
    const concerns =
      input.concerns.length > 0
        ? input.concerns
        : ["Aucun point d'attention particulier détecté."];
    const recommendations = [
      "Poursuivre le suivi régulier des indicateurs de la classe.",
    ];

    return {
      className: input.className,
      attendanceRatePct: input.attendanceRatePct,
      average: input.average,
      positives,
      concerns,
      recommendations,
    };
  }
}
