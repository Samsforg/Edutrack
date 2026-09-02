import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSecretKeys, getPaymentProviderName } from "@/lib/billing/provider";
import type { BillingProvider } from "@/lib/billing/types";
import {
  notifyBillingUsers,
  getSchoolAdminUserIds,
  getSuperAdminUserIds,
  billingNotification,
} from "@/lib/billing/notifications";

export const dynamic = "force-dynamic";

/**
 * WEBHOOK de billing (Stripe / Paystack / Flutterwave) servant à
 * appliquer les événements de paiement sur school_subscriptions.
 *
 * Sécurité :
 *  - vérification de la signature (PAYMENT_WEBHOOK_SECRET) ;
 *  - idempotence via la contrainte unique (provider, event_id) ;
 *  - mise à jour via le service role uniquement.
 */

const RAW_BODY_HEADER = "x-webhook-id";

function verifySignature(payload: string, signature: string | null): boolean {
  const secret = getSecretKeys().webhookSecret;
  if (!secret) {
    // Sans secret de signature configuré, on refuse (pas de mode permissif).
    return false;
  }
  if (!signature) return false;
  try {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const providerName = (getPaymentProviderName() || "stripe") as BillingProvider;
  if (!getSecretKeys().webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "Webhook non configuré" },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get(RAW_BODY_HEADER);

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, error: "Signature invalide" }, { status: 401 });
  }

  let event: {
    id?: string;
    type?: string;
    data?: { object?: Record<string, unknown> };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400 });
  }

  const eventId = event.id || `${providerName}-${Date.now()}`;
  const eventType = event.type || "unknown";
  const supabase = createAdminClient();

  // Idempotence : un seul traitement par (provider, event_id).
  const { data: existing } = await supabase
    .from("billing_events")
    .select("id")
    .eq("provider", providerName)
    .eq("event_id", eventId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, received: true, duplicate: true });
  }

  const { data: evt, error: insErr } = await supabase
    .from("billing_events")
    .insert({
      provider: providerName,
      event_id: eventId,
      event_type: eventType,
      payload: event.data?.object ?? {},
    })
    .select("id")
    .single();

  if (insErr) {
    // Doublon concurrent : on considère traité.
    if (insErr.code === "23505") {
      return NextResponse.json({ ok: true, received: true, duplicate: true });
    }
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  const object = event.data?.object ?? {};
  const customerId = (object.customer as string) || undefined;
  const subscriptionId = (object.id as string) || undefined;

  // Trouve l'abonnement local associé au client/souscription provider.
  let localSub: { school_id: string; plan_id: string; id: string } | null = null;
  if (subscriptionId) {
    const { data } = await supabase
      .from("school_subscriptions")
      .select("school_id, plan_id, id")
      .eq("provider_subscription_id", subscriptionId)
      .maybeSingle();
    localSub = data;
  }
  if (!localSub && customerId) {
    const { data } = await supabase
      .from("school_subscriptions")
      .select("school_id, plan_id, id")
      .eq("provider_customer_id", customerId)
      .maybeSingle();
    localSub = data;
  }

  try {
    await applyEvent(supabase, localSub, eventType, event, eventId);
    const now = new Date().toISOString();
    await supabase
      .from("billing_events")
      .update({ processed: true, processed_at: now })
      .eq("id", evt.id);
  } catch (e) {
    const msg = (e as Error).message;
    await supabase
      .from("billing_events")
      .update({ error: msg, processed: false })
      .eq("id", evt.id);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, received: true });
}

async function applyEvent(
  supabase: ReturnType<typeof createAdminClient>,
  localSub: { school_id: string; plan_id: string; id: string } | null,
  eventType: string,
  event: { data?: { object?: Record<string, unknown> } },
  eventId: string
): Promise<void> {
  if (!localSub) {
    throw new Error(`Aucun abonnement local pour l'événement ${eventType}`);
  }
  const object = event.data?.object ?? {};
  const status = (object.status as string) || "active";
  const cancelAtPeriodEnd = Boolean(object.cancel_at_period_end);
  const periodEnd: number | null =
    typeof object.current_period_end === "number" ? object.current_period_end : null;
  const periodStart: number | null =
    typeof object.current_period_start === "number" ? object.current_period_start : null;

  const patch: Record<string, unknown> = {};
  if (periodStart) patch.current_period_start = new Date(periodStart * 1000).toISOString();
  if (periodEnd) patch.current_period_end = new Date(periodEnd * 1000).toISOString();

  switch (eventType) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      patch.status = status;
      patch.cancel_at_period_end = cancelAtPeriodEnd;
      break;
    case "invoice.paid":
      patch.status = "active";
      break;
    case "invoice.payment_failed":
      patch.status = "past_due";
      break;
    case "customer.subscription.deleted":
      patch.status = "canceled";
      patch.canceled_at = new Date().toISOString();
      break;
    case "checkout.completed":
      patch.status = "active";
      break;
    case "trial.expired":
      patch.status = "expired";
      break;
    default:
      // Événement reconnu mais sans action de mise à jour.
      break;
  }

  if (Object.keys(patch).length > 0) {
    // Audit uniquement si le statut change réellement.
    const { data: before } = await supabase
      .from("school_subscriptions")
      .select("status")
      .eq("id", localSub.id)
      .single();
    const { error } = await supabase
      .from("school_subscriptions")
      .update(patch)
      .eq("id", localSub.id);
    if (error) throw error;

    // Notifications commerciales internes.
    const schoolName = await getSchoolName(supabase, localSub.school_id);
    const status = patch.status as string;
    if (status === "expired") {
      void notifyBillingUsers(
        await getSchoolAdminUserIds(localSub.school_id),
        billingNotification.trial.expired(schoolName)
      );
      void notifyBillingUsers(
        await getSuperAdminUserIds(),
        billingNotification.trial.expired(schoolName)
      );
    } else if (status === "active") {
      void notifyBillingUsers(
        await getSchoolAdminUserIds(localSub.school_id),
        billingNotification.subscription.started(schoolName)
      );
      void notifyBillingUsers(
        await getSuperAdminUserIds(),
        billingNotification.subscription.started(schoolName)
      );
    } else if (status === "past_due") {
      void notifyBillingUsers(
        await getSuperAdminUserIds(),
        { type: "system", title: "Paiement en attente", body: `${schoolName} : paiement en retard.`, link: "/school/billing" }
      );
    }

    if (before && before.status !== patch.status) {
      await supabase.from("billing_audit_logs").insert({
        school_id: localSub.school_id,
        action: `webhook.${eventType}`,
        old_value: { status: before.status },
        new_value: { status: patch.status, event_id: eventId },
      });
    }
  }
}

async function getSchoolName(
  supabase: ReturnType<typeof createAdminClient>,
  schoolId: string
): Promise<string> {
  const { data } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();
  return (data as { name?: string } | null)?.name ?? "École";
}
