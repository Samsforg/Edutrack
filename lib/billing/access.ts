/**
 * EduTrack — Contrôle d'accès par abonnement.
 *
 * `requireActiveSubscription` est la porte d'entrée obligatoire pour
 * l'application scolaire. Tout garde-fou d'écriture (création d'élève,
 * note, présence, annonce) doit aussi passer par `assertCanWrite`.
 */

import { redirect } from "next/navigation";
import {
  getSchoolSubscriptionCached,
  decideAccess,
} from "@/lib/billing/entitlements";
import type { AccessDecision } from "@/lib/billing/types";

/**
 * Charge l'abonnement de l'école et lève une redirection vers
 * /school/billing si l'accès applicatif est refusé.
 * Retourne la décision (utilisable pour le mode read-only).
 */
export async function requireActiveSubscription(
  schoolId: string
): Promise<AccessDecision> {
  const sub = await getSchoolSubscriptionCached(schoolId);
  const decision = decideAccess(sub);

  if (!decision.allowed) {
    redirect("/school/billing?blocked=1");
  }

  return decision;
}

/**
 * Garde-fou d'écriture : lance une erreur si l'école est en lecture
 * seule (abonnement expiré). À appeler dans TOUTES les server actions
 * qui créent/modifient des données applicatives.
 *
 * @throws {Error} si l'école est en read-only / non autorisée.
 */
export async function assertCanWrite(schoolId: string): Promise<void> {
  const sub = await getSchoolSubscriptionCached(schoolId);
  const decision = decideAccess(sub);
  if (!decision.allowed || decision.readOnly) {
    throw new Error(
      decision.readOnly
        ? "Votre abonnement a expiré. Vous pouvez consulter vos données mais pas en créer de nouvelles. Renouvelez votre abonnement pour continuer."
        : "Accès refusé. Reprenez votre abonnement pour continuer."
    );
  }
}

/**
 * Variante pour les server actions qui retournent `{ error }` :
 * retourne un message d'erreur si l'écriture doit être bloquée, sinon null.
 */
export async function writeBlockMessage(schoolId: string): Promise<string | null> {
  const sub = await getSchoolSubscriptionCached(schoolId);
  const decision = decideAccess(sub);
  if (decision.readOnly) {
    return "Votre abonnement a expiré. Vous pouvez consulter vos données mais pas en créer de nouvelles. Renouvelez votre abonnement pour continuer.";
  }
  if (!decision.allowed) {
    return "Accès refusé. Reprenez votre abonnement pour continuer.";
  }
  return null;
}
