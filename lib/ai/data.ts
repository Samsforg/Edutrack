import { createClient } from "@/lib/supabase/server";
import { ANALYSIS_WINDOW } from "@/lib/ai/risk/config";
import type { StudentRiskInput } from "@/lib/ai/types";

/**
 * Couche de lecture des données brutes pour le Risk Engine.
 * Utilise le client RLS (createClient) => chaque requête est déjà
 * filtrée par les politiques de l'utilisateur (multi-tenant garantit
 * qu'une école ne voit jamais les données d'une autre).
 */

export type StudentAttendanceStats = {
  recorded: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
};

/** Taux d'absence (%) = absent / recorded sur la fenêtre. */
export function absenceRate(a: StudentAttendanceStats | null): number {
  if (!a || a.recorded === 0) return 0;
  return (a.absent / a.recorded) * 100;
}

export function attendanceRate(a: StudentAttendanceStats | null): number {
  if (!a || a.recorded === 0) return 0;
  return ((a.present + a.late + a.excused) / a.recorded) * 100;
}

/** Agrégat de présence d'un élève sur les N derniers jours. */
export async function getStudentAttendanceWindow(
  studentId: string,
  days: number = ANALYSIS_WINDOW.attendanceDays
): Promise<StudentAttendanceStats | null> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("attendance")
    .select("status")
    .eq("student_id", studentId)
    .gte("attendance_date", since);
  if (error || !data) return null;

  let recorded = 0,
    present = 0,
    absent = 0,
    late = 0,
    excused = 0;
  const rows = data as unknown as { status: string }[];
  for (const r of rows) {
    recorded++;
    if (r.status === "absent") absent++;
    else if (r.status === "late") late++;
    else if (r.status === "excused") excused++;
    else present++;
  }
  return { recorded, present, absent, late, excused };
}

/** Moyenne /20 d'un élève sur une fenêtre de dates (notes publiées). */
export async function getStudentAverageWindow(
  studentId: string,
  startDate: string,
  endDate: string
): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grades")
    .select("score, max_score, coefficient")
    .eq("student_id", studentId)
    .not("published_at", "is", null)
    .gte("grade_date", startDate)
    .lte("grade_date", endDate);

  if (error || !data || data.length === 0) return null;

  const rows = data as unknown as {
    score: number;
    max_score: number;
    coefficient: number;
  }[];
  let weightedSum = 0;
  let weightSum = 0;
  for (const g of rows) {
    const norm = (g.score / (g.max_score || 20)) * 20;
    const coef = g.coefficient || 1;
    weightedSum += norm * coef;
    weightSum += coef;
  }
  if (weightSum === 0) return null;
  return +(weightedSum / weightSum).toFixed(2);
}

/** Périodes académiques récentes d'une école (pour fenêtre courante/précédente). */
export type PeriodRef = { id: string; start_date: string; end_date: string; name: string };

export async function getRecentPeriods(schoolId: string): Promise<PeriodRef[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("academic_periods")
    .select("id, name, start_date, end_date")
    .eq("school_id", schoolId)
    .order("start_date", { ascending: false })
    .limit(2);
  return ((data as unknown as PeriodRef[]) ?? []).map((p) => ({
    id: p.id,
    start_date: p.start_date,
    end_date: p.end_date,
    name: p.name,
  }));
}

/** Moyenne de classe /20 sur une fenêtre (notes publiées). */
export async function getClassAverageWindow(
  classId: string,
  startDate: string,
  endDate: string
): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("grades")
    .select("score, max_score, coefficient")
    .eq("classroom_id", classId)
    .not("published_at", "is", null)
    .gte("grade_date", startDate)
    .lte("grade_date", endDate);

  if (!data || data.length === 0) return null;
  const rows = data as unknown as {
    score: number;
    max_score: number;
    coefficient: number;
  }[];
  let weightedSum = 0;
  let weightSum = 0;
  for (const g of rows) {
    const norm = (g.score / (g.max_score || 20)) * 20;
    const coef = g.coefficient || 1;
    weightedSum += norm * coef;
    weightSum += coef;
  }
  if (weightSum === 0) return null;
  return +(weightSum / weightSum).toFixed(2);
}

/** Assemble l'entrée du Risk Engine pour un élève. */
export async function buildStudentRiskInput(
  input: {
    schoolId: string;
    studentId: string;
    className?: string | null;
    classId?: string | null;
  }
): Promise<StudentRiskInput> {
  const days = ANALYSIS_WINDOW.attendanceDays;
  const recentDays = ANALYSIS_WINDOW.attendanceRecentDays;

  const [window, recentWindow] = await Promise.all([
    getStudentAttendanceWindow(input.studentId, days),
    getStudentAttendanceWindow(input.studentId, recentDays),
  ]);

  const now = new Date();
  const start = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  const recentStart = new Date(now.getTime() - recentDays * 86400000)
    .toISOString()
    .slice(0, 10);
  const end = now.toISOString().slice(0, 10);

  const [currentAvg, recentAvg, classAvg, periods] = await Promise.all([
    getStudentAverageWindow(input.studentId, start, end),
    getStudentAverageWindow(input.studentId, recentStart, end),
    input.classId
      ? getClassAverageWindow(input.classId, start, end)
      : Promise.resolve(null),
    getRecentPeriods(input.schoolId),
  ]);

  // Moyenne période précédente (si disponible).
  let previousAvg: number | null = null;
  if (periods[1]) {
    previousAvg = await getStudentAverageWindow(
      input.studentId,
      periods[1].start_date,
      periods[1].end_date
    );
  }

  const absenceRatePct = absenceRate(window);
  const lateness = window?.late ?? 0;
  const previousLate = recentWindow?.late ?? 0;
  const lateDeltaPct =
    previousLate === 0 ? (lateness > 0 ? 100 : 0) : ((lateness - previousLate) / previousLate) * 100;

  return {
    schoolId: input.schoolId,
    studentId: input.studentId,
    className: input.className ?? null,
    attendanceRatePct: attendanceRate(window),
    absenceRatePct,
    lateCount: lateness,
    lateDeltaPct,
    currentAvg,
    previousAvg,
    classAvg,
    trendDelta: currentAvg != null && previousAvg != null ? currentAvg - previousAvg : null,
    recentAvgDelta: currentAvg != null && recentAvg != null ? currentAvg - recentAvg : null,
  };
}
