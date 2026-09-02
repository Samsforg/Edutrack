import { createClient } from "@/lib/supabase/server";
import { planByCode, type Plan } from "@/lib/billing/plans";
import type {
  SchoolSubscription,
  SubscriptionStatus,
  UsageCounts,
  UsageResult,
} from "@/lib/billing/types";

type SubscriptionRow = {
  id: string;
  school_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  subscription_plans: {
    code: string;
    name: string;
    price: number;
    currency: string;
    features: Record<string, unknown>;
    max_students: number | null;
    max_teachers: number | null;
    max_admins: number | null;
  } | null;
};

function toSubscription(row: SubscriptionRow): SchoolSubscription | null {
  if (!row.subscription_plans) return null;
  const plan: Plan | undefined = planByCode(row.subscription_plans.code);
  if (!plan) return null;
  const base = {
    id: row.id,
    schoolId: row.school_id,
    planId: row.plan_id,
    planCode: plan.code,
    planName: row.subscription_plans.name,
    planPrice: Number(row.subscription_plans.price),
    planCurrency: row.subscription_plans.currency,
    planFeatures: plan.features,
    maxStudents: row.subscription_plans.max_students ?? 0,
    maxTeachers: row.subscription_plans.max_teachers ?? 0,
    maxAdmins: row.subscription_plans.max_admins ?? 0,
    status: row.status,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    provider: (row.provider as SchoolSubscription["provider"]) ?? "manual",
    providerCustomerId: row.provider_customer_id,
    providerSubscriptionId: row.provider_subscription_id,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    canceledAt: row.canceled_at,
  };
  return {
    ...base,
    effectiveStatus: effectiveStatus(base),
  };
}

/** Calcule le statut "effectif" (expiration des dates trial / période). */
export function effectiveStatus(
  s: Pick<
    SchoolSubscription,
    "status" | "trialEndsAt" | "currentPeriodEnd" | "cancelAtPeriodEnd" | "canceledAt"
  >
): SubscriptionStatus {
  const now = Date.now();
  if (
    s.status === "trialing" &&
    s.trialEndsAt &&
    new Date(s.trialEndsAt).getTime() < now
  ) {
    return "expired";
  }
  if (
    (s.status === "active" || s.status === "trialing" || s.status === "canceled") &&
    s.currentPeriodEnd &&
    new Date(s.currentPeriodEnd).getTime() < now &&
    !(s.status === "canceled" && !s.currentPeriodEnd)
  ) {
    return "expired";
  }
  return s.status;
}

/** Retourne l'abonnement d'une école (RLS : membre ou super admin). */
export async function getSchoolSubscription(
  schoolId: string
): Promise<SchoolSubscription | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_subscriptions")
    .select(
      `id, school_id, plan_id, status, trial_started_at, trial_ends_at,
       current_period_start, current_period_end, provider,
       provider_customer_id, provider_subscription_id,
       cancel_at_period_end, canceled_at,
       subscription_plans(code, name, price, currency, features, max_students, max_teachers, max_admins)`
    )
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error || !data) return null;
  return toSubscription(data as unknown as SubscriptionRow);
}

/** Compte l'usage actuel d'une école (élèves, enseignants, admins). */
export async function getUsage(schoolId: string): Promise<UsageCounts> {
  const supabase = await createClient();
  const [{ count: students }, { count: teachers }, { count: admins }] =
    await Promise.all([
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "active"),
      supabase
        .from("teachers")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("is_active", true),
      supabase
        .from("school_members")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("role", "SCHOOL_ADMIN"),
    ]);
  return {
    students: students ?? 0,
    teachers: teachers ?? 0,
    admins: admins ?? 0,
  };
}

/** Usage + limites du plan pour une école. */
export async function getUsageAndLimits(schoolId: string): Promise<UsageResult> {
  const [sub, usage] = await Promise.all([
    getSchoolSubscription(schoolId),
    getUsage(schoolId),
  ]);
  return {
    students: usage.students,
    teachers: usage.teachers,
    admins: usage.admins,
    studentsLimit: sub?.maxStudents ?? 0,
    teachersLimit: sub?.maxTeachers ?? 0,
    adminsLimit: sub?.maxAdmins ?? 0,
  };
}

/** Vérifie que l'école a un abonnement autorisant un complément d'usage. */
export async function canAdd(type: "students" | "teachers" | "admins", schoolId: string) {
  const { students, teachers, admins, studentsLimit, teachersLimit, adminsLimit } =
    await getUsageAndLimits(schoolId);
  if (type === "students") return students < studentsLimit || studentsLimit <= 0;
  if (type === "teachers") return teachers < teachersLimit || teachersLimit <= 0;
  return admins < adminsLimit || adminsLimit <= 0;
}
