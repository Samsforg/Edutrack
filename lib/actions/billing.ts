"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guard";
import { planByCode } from "@/lib/billing/plans";
import { startCheckout } from "@/lib/billing/checkout";
import type { CheckoutResult } from "@/lib/billing/checkout";
import { getSchoolSubscription } from "@/lib/db/billing";
import {
  notifyBillingUsers,
  getSchoolAdminUserIds,
  getSuperAdminUserIds,
  billingNotification,
} from "@/lib/billing/notifications";

export type BillingResult = { error?: string; ok?: boolean; manual?: boolean };

/** Retourne l'école principale du SCHOOL_ADMIN courant (depuis la session). */
async function resolveSchoolId(): Promise<string> {
  const session = await requireRole(["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  const memberships = session.memberships.filter(
    (m) => m.role === "SCHOOL_ADMIN" && m.school_status === "active"
  );
  const schoolId = memberships[0]?.school_id;
  if (!schoolId) {
    throw new Error("Aucune école active pour ce compte.");
  }
  return schoolId;
}

/** Journalise une action d'abonnement dans billing_audit_logs (service role). */
async function audit(
  schoolId: string,
  userId: string | undefined,
  action: string,
  oldValue: unknown,
  newValue: unknown
): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("billing_audit_logs").insert({
      user_id: userId ?? null,
      school_id: schoolId,
      action,
      old_value: oldValue as never,
      new_value: newValue as never,
    });
    if (error) {
      console.error("[billing.audit]", action, error.message);
    }
  } catch (e) {
    console.error("[billing.audit]", (e as Error).message);
  }
}

/**
 * Changement de plan (upgrade / downgrade). Passe par checkout si un
 * provider est configuré, sinon active manuellement en "trialing".
 */
export async function changePlan(
  input: { planCode: string }
): Promise<BillingResult | CheckoutResult> {
  const parsed = z
    .object({ planCode: z.string().min(1) })
    .safeParse(input);
  if (!parsed.success) {
    return { error: "Plan invalide" };
  }

  const plan = planByCode(parsed.data.planCode);
  if (!plan) {
    return { error: "Plan inconnu" };
  }

  const session = await requireRole(["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  const schoolId = await resolveSchoolId();
  const supabase = await createClient();

  const current = await getSchoolSubscription(schoolId);
  if (current && current.planCode === plan.code) {
    return { error: "Vous êtes déjà sur ce plan." };
  }

  const schoolProfile = (await supabase
    .from("schools")
    .select("name, email")
    .eq("id", schoolId)
    .maybeSingle()) as { data: { name: string; email: string | null } | null };

  const checkout = await startCheckout({
    schoolId,
    schoolName: schoolProfile?.data?.name ?? "École",
    schoolEmail: schoolProfile?.data?.email,
    planCode: plan.code,
    planPrice: plan.price,
    currency: plan.currency,
    interval: plan.billingInterval,
    isUpgradeFromTrial: current?.status === "trialing",
  });

  if (checkout.ok && checkout.manual) {
    // Sans provider : activation manuelle du plan (reste en trial / est
    // basculé à active par le super admin ou le webhook).
    const { data: newPlan } = await supabase
      .from("subscription_plans")
      .select("id")
      .eq("code", plan.code)
      .single();
    const { error } = await supabase
      .from("school_subscriptions")
      .update({ plan_id: newPlan?.id, status: "active" })
      .eq("school_id", schoolId);
    if (error) {
      return { error: error.message };
    }
    await audit(
      schoolId,
      session.user.id,
      "plan.changed_manually",
      { from: current?.planCode },
      { to: plan.code, status: "active" }
    );
    const schoolName = schoolProfile?.data?.name ?? "École";
    void notifyBillingUsers(await getSchoolAdminUserIds(schoolId), billingNotification.subscription.started(schoolName));
    void notifyBillingUsers(await getSuperAdminUserIds(), billingNotification.subscription.started(schoolName));
    revalidatePath("/school/billing");
    revalidatePath("/school/onboarding");
    return { ok: true, manual: true };
  }

  if (checkout.ok) {
    revalidatePath("/school/billing");
    return checkout;
  }

  return { error: "Impossible de démarrer le paiement." };
}

/** Annule l'abonnement en fin de période. */
export async function cancelSubscription(): Promise<BillingResult> {
  const session = await requireRole(["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  const schoolId = await resolveSchoolId();
  const supabase = await createClient();

  const { data: school } = (await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle()) as { data: { name: string } | null };
  const schoolName = school?.name ?? "École";

  const { error } = await supabase
    .from("school_subscriptions")
    .update({
      cancel_at_period_end: true,
      canceled_at: new Date().toISOString(),
    })
    .eq("school_id", schoolId);
  if (error) {
    return { error: error.message };
  }
  await audit(
    schoolId,
    session.user.id,
    "subscription.canceled",
    { cancel_at_period_end: false },
    { cancel_at_period_end: true }
  );
  void notifyBillingUsers(await getSuperAdminUserIds(), billingNotification.subscription.canceled(schoolName));
  revalidatePath("/school/billing");
  return { ok: true };
}

/** Reprend un abonnement en cours d'annulation. */
export async function resumeSubscription(): Promise<BillingResult> {
  const session = await requireRole(["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  const schoolId = await resolveSchoolId();
  const supabase = await createClient();

  const { data: school } = (await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle()) as { data: { name: string } | null };
  const schoolName = school?.name ?? "École";

  const { error } = await supabase
    .from("school_subscriptions")
    .update({
      cancel_at_period_end: false,
      canceled_at: null,
    })
    .eq("school_id", schoolId)
    .eq("cancel_at_period_end", true);
  if (error) {
    return { error: error.message };
  }
  await audit(
    schoolId,
    session.user.id,
    "subscription.resumed",
    { cancel_at_period_end: true },
    { cancel_at_period_end: false }
  );
  void notifyBillingUsers(await getSuperAdminUserIds(), billingNotification.subscription.renewed(schoolName));
  revalidatePath("/school/billing");
  return { ok: true };
}

/** Demande d'activation manuelle (pas de provider configuré). */
export async function requestManualActivation(): Promise<BillingResult> {
  await requireRole(["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  // Aucune opération bancaire : on dirige vers le formulaire de contact.
  return {
    ok: true,
    manual: true,
    error: "Le paiement en ligne n'est pas encore configuré. Contactez notre équipe.",
  };
}
