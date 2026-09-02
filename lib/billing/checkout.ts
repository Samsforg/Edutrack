/**
 * EduTrack — Checkout (session de paiement d'abonnement).
 *
 * S'appuie sur `getPaymentProvider()`. Si aucun provider n'est configuré,
 * on NE crée pas de paiement : on retourne `{ manual: true }` pour que
 * l'UI propose l'activation manuelle / la demande de contact.
 */

import { getPaymentProvider, providerConfigured } from "@/lib/billing/provider";
import { formatPrice } from "@/lib/billing/plans";
import type { PlanCode } from "@/lib/billing/plans";

export type CheckoutResult =
  | { ok: true; checkoutUrl: string; manual: false }
  | { ok: true; checkoutUrl: string; manual: true }
  | { ok: false; error: string };

/**
 * Déclenche le checkout d'abonnement pour une école.
 * Si aucun provider n'est câblé, retourne `manual: true` (activation manuelle).
 */
export async function startCheckout(params: {
  schoolId: string;
  schoolName: string;
  schoolEmail?: string | null;
  planCode: PlanCode;
  planPrice: number;
  currency: string;
  interval: "month" | "year";
  isUpgradeFromTrial?: boolean;
}): Promise<CheckoutResult> {
  const provider = getPaymentProvider();

  if (!providerConfigured()) {
    // Pas de paiement maison : on dirige vers l'activation manuelle.
    return {
      ok: true,
      checkoutUrl: "",
      manual: true,
    };
  }

  try {
    const schoolId = params.schoolId;
    const { providerCustomerId } = await provider.createCustomer({
      schoolId,
      schoolName: params.schoolName,
      schoolEmail: params.schoolEmail,
    });

    const { checkoutUrl } = await provider.createCheckout({
      schoolId,
      providerCustomerId,
      planId: "",
      planCode: params.planCode,
      planPrice: params.planPrice,
      currency: params.currency,
      interval: params.interval,
      successUrl: `${getBaseUrl()}/school/billing?checkout=success`,
      cancelUrl: `${getBaseUrl()}/school/billing?checkout=cancel`,
    });

    if (!checkoutUrl) {
      return { ok: true, checkoutUrl: "", manual: true };
    }
    return { ok: true, checkoutUrl, manual: false };
  } catch {
    return { ok: true, checkoutUrl: "", manual: true };
  }
}

/** URL de base de l'application (utile webhook / emails). */
export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
}

/** Libellé de prix pour l'UI. */
export { formatPrice };
