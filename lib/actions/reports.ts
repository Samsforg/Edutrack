"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { csvRow } from "@/lib/csv";

export type ReportError = { error?: string; ok?: boolean };

const HEADER_MAP = {
  students: ["matricule", "first_name", "last_name", "gender", "birth_date", "status", "class_name"],
  attendance: ["student_id", "first_name", "last_name", "class_name", "attendance_date", "status"],
  grades: ["student_id", "first_name", "last_name", "matricule", "class_name", "subject_name", "score", "max_score", "published_at"],
  stats: ["indicator", "value"],
};

async function requireAdmin(schoolId: string) {
  const session = await getSession();
  if (!session?.user) return null;
  const m = session.memberships.find((m) => m.school_id === schoolId);
  if (!m || m.role !== "SCHOOL_ADMIN") return null;
  return session;
}

/**
 * Builds CSV lines for a given report type, server-side and scoped to the
 * session's school. Cells are escaped against CSV formula injection.
 * Limit keeps exports bounded.
 */
export async function generateReport(
  schoolId: string,
  type: keyof typeof HEADER_MAP,
  opts: { from?: string; to?: string; classId?: string } = {}
): Promise<{ ok?: boolean; error?: string; lines: string[] }> {
  const session = await requireAdmin(schoolId);
  if (!session) return { error: "Accès refusé", lines: [] };
  const supabase = await createClient();

  const header = HEADER_MAP[type];
  const lines: string[] = [csvRow(header)];
  const LIMIT = 10_000;

  if (type === "students") {
    let q = supabase
      .from("students")
      .select("matricule, first_name, last_name, gender, birth_date, status, classroom_id, classes(name)")
      .eq("school_id", schoolId)
      .order("last_name", { ascending: true })
      .limit(LIMIT);
    if (opts.classId) q = q.eq("classroom_id", opts.classId);
    const { data } = await q;
    for (const r of (data ?? []) as unknown as {
      matricule: string; first_name: string; last_name: string;
      gender: string | null; birth_date: string | null; status: string;
      classes: { name: string } | null;
    }[]) {
      lines.push(csvRow([r.matricule, r.first_name, r.last_name, r.gender ?? "", r.birth_date ?? "", r.status, r.classes?.name ?? ""]));
    }
  } else if (type === "attendance") {
    let q = supabase
      .from("attendance")
      .select("student_id, attendance_date, status, students(first_name, last_name), classes(name), classroom_id")
      .eq("school_id", schoolId)
      .order("attendance_date", { ascending: true })
      .limit(LIMIT);
    if (opts.from) q = q.gte("attendance_date", opts.from);
    if (opts.to) q = q.lte("attendance_date", opts.to);
    if (opts.classId) q = q.eq("classroom_id", opts.classId);
    const { data } = await q;
    for (const r of (data ?? []) as unknown as {
      student_id: string; attendance_date: string; status: string; classroom_id: string | null;
      students: { first_name: string; last_name: string } | null;
      classes: { name: string } | null;
    }[]) {
      lines.push(csvRow([
        r.student_id,
        r.students?.first_name ?? "",
        r.students?.last_name ?? "",
        r.classes?.name ?? "",
        r.attendance_date,
        r.status,
      ]));
    }
  } else if (type === "grades") {
    let q = supabase
      .from("grades")
      .select("student_id, score, max_score, published_at, subject_id, classroom_id, subjects(name), students(first_name, last_name, matricule), classes(name)")
      .eq("school_id", schoolId)
      .order("grade_date", { ascending: false })
      .limit(LIMIT);
    if (opts.classId) q = q.eq("classroom_id", opts.classId);
    const { data } = await q;
    for (const r of (data ?? []) as unknown as {
      student_id: string; score: number; max_score: number; published_at: string | null;
      subject_id: string; classroom_id: string | null;
      subjects: { name: string } | null;
      students: { first_name: string; last_name: string; matricule: string } | null;
      classes: { name: string } | null;
    }[]) {
      lines.push(csvRow([
        r.student_id,
        r.students?.first_name ?? "",
        r.students?.last_name ?? "",
        r.students?.matricule ?? "",
        r.classes?.name ?? "",
        r.subjects?.name ?? "",
        r.score,
        r.max_score,
        r.published_at ? new Date(r.published_at).toISOString() : "",
      ]));
    }
  } else if (type === "stats") {
    const { data: kpi } = await supabase
      .from("school_kpis")
      .select("*")
      .eq("school_id", schoolId)
      .maybeSingle();
    const k = (kpi as unknown as Record<string, number | string | null>) ?? {};
    lines.push(csvRow(["Élèves actifs", k.student_count ?? 0]));
    lines.push(csvRow(["Classes", k.class_count ?? 0]));
    lines.push(csvRow(["Enseignants actifs", k.teacher_count ?? 0]));
    lines.push(csvRow(["Parents connectés", k.linked_parent_count ?? 0]));
  }

  return { ok: true, lines };
}
