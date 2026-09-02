import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Métriques SaaS pour le super admin (voir docs/METRICS.md).
 * Uses service role — super admin dashboard only.
 */

export type SaasMetrics = {
  activeSchools: number;
  trialSchools: number;
  paidSchools: number;
  trialConversionRate: number;
  churnRate: number;
  mrr: number;
  arr: number;
  arpa: number;
  studentsPerSchool: number;
  pastDueSchools: number;
  expiredSchools: number;
  totalSchools: number;
};

export async function getSaasMetrics(): Promise<SaasMetrics> {
  const supabase = createAdminClient();

  const [total, statuses, studentsCount, schoolsCount] = await Promise.all([
    supabase.from("schools").select("id", { count: "exact", head: true }),
    supabase
      .from("school_subscriptions")
      .select("status, school_id"),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("schools").select("id", { count: "exact", head: true }),
  ]);

  const totalSchools = total.count ?? 0;
  const studentsCountN = studentsCount.count ?? 0;
  const schoolsCountN = schoolsCount.count ?? 0;

  const rows: { status: string }[] = statuses.data ?? [];
  const byStatus = (s: string) => rows.filter((r) => r.status === s).length;
  const trialing = byStatus("trialing");
  const active = byStatus("active");
  const pastDue = byStatus("past_due");
  const expired = byStatus("expired");
  const canceled = byStatus("canceled");

  // Prix annuels normalisés en MRR (voir lib/billing/plans.ts : annualPriceToMonthly).
  const sub = await getSubscriptionPaidSchools();
  const mrr = Math.round(sub.reduce((acc, s) => acc + annualToMonthly(s.price), 0));
  const arr = mrr * 12;
  const paidSchools = sub.length;
  const arpa = paidSchools > 0 ? Math.round(mrr / paidSchools) : 0;

  const trialConversionRate =
    trialing > 0 ? Math.round((active / (trialing + active)) * 100) : 0;
  const churnRate =
    active + canceled > 0 ? Math.round((canceled / (active + canceled)) * 100) : 0;

  return {
    activeSchools: active,
    trialSchools: trialing,
    paidSchools,
    trialConversionRate,
    churnRate,
    mrr,
    arr,
    arpa,
    studentsPerSchool: schoolsCountN > 0 ? Math.round(studentsCountN / schoolsCountN) : 0,
    pastDueSchools: pastDue,
    expiredSchools: expired,
    totalSchools,
  };
}

function annualToMonthly(price: number): number {
  return price / 12;
}

async function getSubscriptionPaidSchools(): Promise<{ price: number }[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("school_subscriptions")
    .select("status, subscription_plans(price)")
    .in("status", ["active", "past_due"]);
  return (data ?? [])
    .filter(
      (r: { subscription_plans: unknown }) => r.subscription_plans
    )
    .map((r: { subscription_plans: { price: number } }) => ({
      price: Number(r.subscription_plans.price),
    }));
}

export type LeadManagementRow = {
  id: string;
  name: string;
  school_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  est_students: number | null;
  message: string | null;
  status: string;
  source: string;
  created_at: string;
};

export async function listLeads(): Promise<LeadManagementRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("school_leads")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as LeadManagementRow[];
}

export async function updateLeadStatus(
  leadId: string,
  status: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("school_leads")
    .update({ status })
    .eq("id", leadId);
  return !error;
}
