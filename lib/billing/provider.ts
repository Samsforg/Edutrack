/**
 * EduTrack — Abstraction du fournisseur de paiement.
 *
 * Interface commune pour brancher Stripe, Paystack, Flutterwave... sans
 * modifier le reste du code. En l'absence de `PAYMENT_PROVIDER`, on retombe
 * sur l'implémentation "manual" (no-op) : elle ne crée AUCUN paiement réel,
 * elle enregistre simplement l'intention pour l'activation manuelle.
 *
 * RÈGLE : ne JAMAIS faire de paiement "maison". Sans provider, on refuse
 * et on oriente vers l'activation manuelle / le support.
 */

import type {
  SubscriptionStatus,
  BillingProvider,
} from "@/lib/billing/types";

/** Rôle du SDK que tout provider doit fournir. */
export interface PaymentProvider {
  readonly name: BillingProvider;
  readonly configured: boolean;

  /** Crée (ou retourne) un client chez le provider pour une école. */
  createCustomer(params: {
    schoolId: string;
    schoolName: string;
    schoolEmail?: string | null;
  }): Promise<{ providerCustomerId: string }>;

  /** Crée une session de checkout d'abonnement. */
  createCheckout(params: {
    schoolId: string;
    providerCustomerId?: string | null;
    planId: string;
    planCode: string;
    planPrice: number;
    currency: string;
    interval: "month" | "year";
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ checkoutUrl: string }>;

  /** Récupère l'abonnement côté provider. */
  getSubscription(providerSubscriptionId: string): Promise<{
    providerSubscriptionId: string;
    status: string;
    currentPeriodEnd?: number | null;
    cancelAtPeriodEnd: boolean;
  }>;

  /** Annule l'abonnement (fin de période) chez le provider. */
  cancelSubscription(providerSubscriptionId: string): Promise<void>;

  /** Reprend un abonnement en cours d'annulation. */
  resumeSubscription(providerSubscriptionId: string): Promise<void>;
}

/** Vérifie la signature du webhook du provider. */
export type WebhookVerifyResult = {
  ok: boolean;
  provider: string;
};

const PROVIDER = getEnv("PAYMENT_PROVIDER", "").toLowerCase();

export function getPaymentProviderName(): string {
  return PROVIDER;
}

export function getSecretKeys() {
  return {
    secret: process.env.PAYMENT_SECRET_KEY ?? "",
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET ?? "",
  };
}

function getEnv(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

/** Implémentation no-op (pas de provider configuré). */
class ManualProvider implements PaymentProvider {
  readonly name: BillingProvider = "manual";
  readonly configured = false;

  async createCustomer(_params: {
    schoolId: string;
    schoolName: string;
    schoolEmail?: string | null;
  }): Promise<{ providerCustomerId: string }> {
    void _params;
    return { providerCustomerId: "" };
  }

  async createCheckout(_params: {
    schoolId: string;
    providerCustomerId?: string | null;
    planId: string;
    planCode: string;
    planPrice: number;
    currency: string;
    interval: "month" | "year";
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ checkoutUrl: string }> {
    void _params;
    return { checkoutUrl: "" };
  }

  async getSubscription(_id: string) {
    void _id;
    return {
      providerSubscriptionId: "",
      status: "",
      cancelAtPeriodEnd: false,
    };
  }

  async cancelSubscription(_id: string): Promise<void> {
    void _id;
    throw new Error(
      "Aucun fournisseur de paiement configuré (PAYMENT_PROVIDER manquant)."
    );
  }

  async resumeSubscription(_id: string): Promise<void> {
    void _id;
    throw new Error(
      "Aucun fournisseur de paiement configuré (PAYMENT_PROVIDER manquant)."
    );
  }
}

/** Retourne l'instance du provider courant (seule source). */
export function getPaymentProvider(): PaymentProvider {
  if (PROVIDER === "stripe") {
    // L'implémentation concrète (avec SDK) se brancherait ici.
    return new ManualProvider();
  }
  return new ManualProvider();
}

/** Statut normalisé: valeur courante si valide, sinon défaut. */
export function normalizeStatus(
  status: string | undefined
): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "expired":
    case "suspended":
      return status;
    default:
      return "active";
  }
}

let _warned = false;
/** Abonnement en cours : statut normalisé depuis le provider. */
export function providerConfigured(): boolean {
  if (!_warned && !PROVIDER) {
    _warned = true;
  }
  return !!PROVIDER;
}
