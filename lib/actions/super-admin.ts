"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guard";

const schoolSchema = z.object({
  name: z.string().min(1, "Nom d’établissement requis"),
  code: z
    .string()
    .min(2, "Code requis")
    .max(20)
    .transform((v) => v.toUpperCase()),
});

export type Result = { error?: string; ok?: boolean };

export async function createSchool(
  input: z.infer<typeof schoolSchema>
): Promise<Result> {
  const parsed = schoolSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const session = await requireRole(["SUPER_ADMIN"]);
  void session;

  const supabase = await createClient();
  const { error } = await supabase.from("schools").insert({
    name: parsed.data.name,
    code: parsed.data.code,
    status: "active",
  });
  if (error) {
    if (error.code === "23505") {
      return { error: "Ce code d’établissement existe déjà." };
    }
    return { error: error.message };
  }

  revalidatePath("/app/super-admin");
  return { ok: true };
}

const leadStatusSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(["new", "contacted", "demo", "trial", "converted", "lost"]),
});

export async function updateLeadStatus(
  input: z.infer<typeof leadStatusSchema>
): Promise<Result> {
  const parsed = leadStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  await requireRole(["SUPER_ADMIN"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("school_leads")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.leadId);
  if (error) return { error: error.message };
  revalidatePath("/app/super-admin/leads");
  return { ok: true };
}

const overrideSubSchema = z.object({
  schoolId: z.string().uuid(),
  status: z.enum(["trialing", "active", "past_due", "canceled", "expired", "suspended"]),
  planCode: z.string().min(1),
});

export type AdminOverrideResult = { error?: string; ok?: boolean };

/**
 * Le super admin peut exceptionnellement modifier le statut / plan d'une
 * école. Toute modification est journalisée dans billing_audit_logs.
 */
export async function overrideSubscription(
  input: z.infer<typeof overrideSubSchema>
): Promise<AdminOverrideResult> {
  const parsed = overrideSubSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const session = await requireRole(["SUPER_ADMIN"]);
  const supabase = await createClient();

  const { data: sub } = await supabase
    .from("school_subscriptions")
    .select("id, status, subscription_plans(code)")
    .eq("school_id", parsed.data.schoolId)
    .maybeSingle();
  if (!sub) return { error: "Aucun abonnement pour cette école" };

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("code", parsed.data.planCode)
    .single();
  if (!plan) return { error: "Plan inconnu" };

  const { error } = await supabase
    .from("school_subscriptions")
    .update({ status: parsed.data.status, plan_id: plan.id })
    .eq("school_id", parsed.data.schoolId);
  if (error) return { error: error.message };

  await supabase.from("billing_audit_logs").insert({
    user_id: session.user.id,
    school_id: parsed.data.schoolId,
    action: `subscription.manually_changed`,
    old_value: { status: sub.status, plan: (sub.subscription_plans as { code?: string })?.code },
    new_value: { status: parsed.data.status, plan: parsed.data.planCode },
  });

  revalidatePath("/app/super-admin");
  revalidatePath("/app/super-admin/leads");
  return { ok: true };
}