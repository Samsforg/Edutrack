import { createAdminClient } from "@/lib/supabase/admin";
import { buildStudentRiskInput } from "@/lib/ai/data";
import { detectStudentRisks, detectClassAnomaly } from "@/lib/ai/risk/detect";
import { insertInsight, bumpAiUsage } from "@/lib/ai/store";
import { ANALYSIS_WINDOW } from "@/lib/ai/risk/config";
import type { InsightDraft } from "@/lib/ai/risk/detect";

/**
 * Jobs de détection (traités en tâche de fond, jamais pendant le rendu).
 * Utilisent le client service-role => analyse multi-tenant sans toucher
 * aux données d'autres écoles (chaque job est scopé par school_id).
 */

type StudentRef = { id: string; school_id: string; classroom_id: string | null; first_name: string; last_name: string };

function nowStart(): string {
  return new Date(Date.now() - ANALYSIS_WINDOW.gradeWindowDays * 86400000).toISOString().slice(0, 10);
}

/** Enumére les élèves actifs d'une école (service role, pour job). */
async function listActiveStudents(schoolId: string): Promise<StudentRef[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("students")
    .select("id, school_id, classroom_id, first_name, last_name")
    .eq("school_id", schoolId)
    .eq("status", "active");
  return (data as unknown as StudentRef[]) ?? [];
}

async function persistDrafts(
  schoolId: string,
  drafts: InsightDraft[],
  studentId?: string | null,
  classId?: string | null
): Promise<number> {
  let inserted = 0;
  for (const d of drafts) {
    const { inserted: ok } = await insertInsight({
      schoolId,
      studentId: studentId ?? null,
      classId: classId ?? null,
      type: d.type,
      severity: d.severity,
      title: d.title,
      summary: d.summary,
      evidence: d.evidence,
      recommendation: d.recommendation,
      confidence: d.confidence,
      status: "active",
      dedupKey: d.dedupKey,
      generatedAt: new Date().toISOString(),
      expiresAt: null,
    });
    if (ok) inserted++;
  }
  if (inserted > 0) {
    await bumpAiUsage(schoolId, { insights: inserted });
  }
  return inserted;
}

/**
 * Analyse les risques de présence + performance d'un élève et persiste
 * les insights correspondants (avec déduplication).
 */
export async function detectStudentAndPersist(
  schoolId: string,
  student: StudentRef
): Promise<InsightDraft[]> {
  const input = await buildStudentRiskInput({
    schoolId,
    studentId: student.id,
    className: null,
    classId: student.classroom_id,
  });
  return detectStudentRisks(input, nowStart());
}

/** Détection des risques d'absentéisme pour toute une école. */
export async function detectAttendanceRisks(
  schoolId: string
): Promise<number> {
  const students = await listActiveStudents(schoolId);
  let total = 0;
  for (const s of students) {
    const drafts = await detectStudentAndPersist(schoolId, s);
    total += await persistDrafts(schoolId, drafts, s.id, s.classroom_id);
  }
  return total;
}

/** Détection des risques de performance (baisse/progression) pour toute une école. */
export async function detectPerformanceRisks(
  schoolId: string
): Promise<number> {
  const students = await listActiveStudents(schoolId);
  let total = 0;
  for (const s of students) {
    const drafts = await detectStudentAndPersist(schoolId, s);
    total += await persistDrafts(schoolId, drafts, s.id, s.classroom_id);
  }
  return total;
}

/** Détection d'anomalies à l'échelle des classes d'une école. */
export async function detectClassAnomalies(schoolId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, school_id")
    .eq("school_id", schoolId);
  const classList = (classes as unknown as { id: string; name: string; school_id: string }[]) ?? [];

  let inserted = 0;
  for (const c of classList) {
    const start = nowStart();
    const end = new Date().toISOString().slice(0, 10);

    const attResult = await supabase
      .from("attendance")
      .select("status")
      .eq("classroom_id", c.id)
      .gte("attendance_date", start);
    let attendancePct: number | null = null;
    const attRows = (attResult.data as unknown as { status: string }[]) ?? [];
    if (attRows.length > 0) {
      const nonAbsent = attRows.filter((r) => r.status !== "absent").length;
      attendancePct = (nonAbsent / attRows.length) * 100;
    }

    const gradeResult = await supabase
      .from("grades")
      .select("score, max_score, coefficient")
      .eq("classroom_id", c.id)
      .not("published_at", "is", null)
      .gte("grade_date", start)
      .lte("grade_date", end);
    let avg: number | null = null;
    const gradeRows = (gradeResult.data as unknown as {
      score: number;
      max_score: number;
      coefficient: number;
    }[]) ?? [];
    if (gradeRows.length > 0) {
      let ws = 0,
        wc = 0;
      for (const g of gradeRows) {
        const n = (g.score / (g.max_score || 20)) * 20;
        ws += n * (g.coefficient || 1);
        wc += g.coefficient || 1;
      }
      if (wc > 0) avg = +(ws / wc).toFixed(2);
    }

    const draft = detectClassAnomaly(schoolId, c.id, c.name, {
      attendanceRatePct: attendancePct,
      average: avg,
    });
    if (draft) {
      const { inserted: ok } = await insertInsight({
        schoolId,
        studentId: null,
        classId: c.id,
        type: draft.type,
        severity: draft.severity,
        title: draft.title,
        summary: draft.summary,
        evidence: draft.evidence,
        recommendation: draft.recommendation,
        confidence: draft.confidence,
        status: "active",
        dedupKey: draft.dedupKey,
        generatedAt: new Date().toISOString(),
        expiresAt: null,
      });
      if (ok) inserted++;
    }
  }
  if (inserted > 0) await bumpAiUsage(schoolId, { insights: inserted });
  return inserted;
}

/** Marque les insights expirés en status 'resolved' (nettoyage). */
export async function cleanupExpiredInsights(): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ai_insights")
    .update({ status: "resolved" })
    .eq("status", "active")
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString())
    .select("id");
  return (data as unknown as { id: string }[] | null)?.length ?? 0;
}
