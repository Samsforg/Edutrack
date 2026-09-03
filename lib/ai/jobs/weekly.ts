import { createAdminClient } from "@/lib/supabase/admin";
import { getParentUserIdsForSchool } from "@/lib/db/notify";
import { notifyBillingUsers, getSuperAdminUserIds } from "@/lib/billing/notifications";
import { listInsights } from "@/lib/ai/store";
import type { AiInsight } from "@/lib/ai/types";

/**
 * Weekly digest (synthèse hebdomadaire, §30).
 * Traité en arrière-plan (job) : il génère des notifications internes,
 * jamais pendant le rendu du dashboard.
 */

type WeeklyData = {
  schoolName: string;
  attendanceRatePct: number | null;
  lateCount: number;
  average: number | null;
  progressionText: string[];
  toWatchText: string[];
};

/** Agrégats simples d'une école sur la semaine pour le digest. */
async function buildSchoolDigest(schoolId: string): Promise<WeeklyData> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);

  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();

  // Présence / retards
  const att = await supabase
    .from("attendance")
    .select("status")
    .eq("school_id", schoolId)
    .gte("attendance_date", since);
  const attRows = (att.data as unknown as { status: string }[]) ?? [];
  let attendancePct: number | null = null;
  let lateCount = 0;
  if (attRows.length > 0) {
    const nonAbsent = attRows.filter((r) => r.status !== "absent").length;
    attendancePct = (nonAbsent / attRows.length) * 100;
    lateCount = attRows.filter((r) => r.status === "late").length;
  }

  // Moyenne
  const gr = await supabase
    .from("grades")
    .select("score, max_score, coefficient")
    .eq("school_id", schoolId)
    .not("published_at", "is", null)
    .gte("grade_date", since)
    .lte("grade_date", end);
  const gradeRows = (gr.data as unknown as {
    score: number;
    max_score: number;
    coefficient: number;
  }[]) ?? [];
  let average: number | null = null;
  if (gradeRows.length > 0) {
    let ws = 0,
      wc = 0;
    for (const g of gradeRows) {
      const n = (g.score / (g.max_score || 20)) * 20;
      ws += n * (g.coefficient || 1);
      wc += g.coefficient || 1;
    }
    if (wc > 0) average = +(ws / wc).toFixed(2);
  }

  // Insights actifs
  const insights = await listInsights({ schoolId, status: "active", limit: 50 });
  const positive = insights.filter((i) => i.type === "positive_trend" || i.type === "improvement");
  const toWatch = insights.filter((i) =>
    ["attendance_risk", "performance_risk", "performance_drop", "attendance_drop", "class_anomaly"].includes(
      i.type
    )
  );

  return {
    schoolName: (school as { name?: string } | null)?.name ?? "École",
    attendanceRatePct: attendancePct,
    lateCount,
    average,
    progressionText: positive.slice(0, 3).map((i) => i.title),
    toWatchText: toWatch.slice(0, 3).map((i) => i.title),
  };
}

function fmtPct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v)}%`;
}
function fmtAvg(v: number | null): string {
  return v == null ? "—" : v.toFixed(1).replace(".", ",");
}

/** Génère les digests hebdomadaires pour une école (parents + admins). */
export async function generateWeeklyDigests(schoolId: string): Promise<number> {
  const digest = await buildSchoolDigest(schoolId);
  const parentIds = await getParentUserIdsForSchool(schoolId);
  const admins = await notifyAdmins(schoolId);
  void admins;

  const parentBody = [
    `Présence : ${fmtPct(digest.attendanceRatePct)}`,
    `Retards : ${digest.lateCount}`,
    `Moyenne : ${fmtAvg(digest.average)}`,
    digest.progressionText.length ? `Progression : ${digest.progressionText.join(", ")}` : "",
    digest.toWatchText.length ? `À surveiller : ${digest.toWatchText.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await notifyBillingUsers(parentIds, {
    type: "weekly_summary",
    title: "Votre résumé de la semaine",
    body: parentBody,
    link: "/app/parent/children",
  });

  return parentIds.length;
}

async function notifyAdmins(schoolId: string): Promise<number> {
  const digest = await buildSchoolDigest(schoolId);
  const supers = await getSuperAdminUserIds();
  await notifyBillingUsers(supers, {
    type: "weekly_summary",
    title: `Résumé hebdomadaire — ${digest.schoolName}`,
    body: [
      `Présence : ${fmtPct(digest.attendanceRatePct)}`,
      `Moyenne : ${fmtAvg(digest.average)}`,
      `Classes à surveiller : ${digest.toWatchText.length}`,
    ].join("\n"),
    link: "/app/admin/analytics",
  });
  return supers.length;
}

export { buildSchoolDigest };
export type { WeeklyData };
