import type { AccessDecision } from "@/lib/billing/types";

/**
 * Libellés humains par état d'abonnement pour les bandeaux / bannières UI.
 */
export function decisionLabel(
  decision: AccessDecision,
  trialEndsAt: string | null
): string {
  switch (decision.status) {
    case "trialing":
      return `Période d'essai gratuit en cours${
        trialEndsAt
          ? ` — se termine le ${new Date(trialEndsAt).toLocaleDateString("fr-FR")}`
          : ""
      }.`;
    case "past_due":
      return "Paiement en attente. Régularisez pour éviter une suspension.";
    case "canceled":
      return "Votre abonnement a été résilié. Vous gardez accès jusqu'à la fin de la période payée.";
    case "expired":
      return "Votre abonnement a expiré. Vous pouvez consulter vos données mais pas en créer de nouvelles.";
    case "suspended":
      return "Votre abonnement est suspendu. Reprenez-le pour continuer.";
    default:
      return "Abonnement actif.";
  }
}
