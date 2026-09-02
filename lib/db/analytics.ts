import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/types/enums";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export type SchoolKpis = {
  student_count: number;
  class_count: number;
  teacher_count: number;
  linked_parent_count: number;
  attendance_rate: number | null;
  absences: number;
  lates: number;
  overall_average: number | null;
};

/**
 * Global KPIs for the school, aggregated server-side from the SQL views
 * (security_invoker -> RLS respectée). Avoids loading whole tables client-side.
 */
export async function getSchoolKpis(schoolId: string): Promise<SchoolKpis> {
  const supabase = await createClient();

  const [{ data: kpi }, { data: att }, { data: grades }] = await Promise.all([
    supabase.from("school_kpis").select("*").eq("school_id", schoolId).maybeSingle(),
    supabase
      .from("attendance")
      .select("status")
      .eq("school_id", schoolId)
      .gte("attendance_date", isoDaysAgo(30)),
    supabase
      .from("grades")
      .select("score, max_score")
      .eq("school_id", schoolId),
  ]);

  const attRows = (att ?? []) as unknown as { status: AttendanceStatus }[];
  const present = attRows.filter((a) => a.status === "present").length;
  const absent = attRows.filter((a) => a.status === "absent").length;
  const late = attRows.filter((a) => a.status === "late").length;
  const total = attRows.length;
  const attendanceRate =
    total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : null;

  const gradeRows = (grades ?? []) as unknown as { score: number; max_score: number }[];
  let overallAverage: number | null = null;
  const valid = gradeRows.filter((g) => g.max_score > 0);
  if (valid.length) {
    overallAverage =
      Math.round(
        (valid.reduce((s, g) => s + (g.score / g.max_score) * 100, 0) / valid.length) * 10
      ) / 10;
  }

  const kpiRow = (kpi as unknown as {
    student_count: number;
    class_count: number;
    teacher_count: number;
    linked_parent_count: number;
  } | null) ?? null;

  return {
    student_count: kpiRow?.student_count ?? 0,
    class_count: kpiRow?.class_count ?? 0,
    teacher_count: kpiRow?.teacher_count ?? 0,
    linked_parent_count: kpiRow?.linked_parent_count ?? 0,
    attendance_rate: attendanceRate,
    absences: absent,
    lates: late,
    overall_average: overallAverage,
  };
}

export type AttendancePoint = {
  date: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
};

/**
 * Daily attendance counts for the last `days` days (school-wide).
 */
export async function getAttendanceTrend(
  schoolId: string,
  days = 30
): Promise<AttendancePoint[]> {
  const supabase = await createClient();
  const from = isoDaysAgo(days);
  const { data, error } = await supabase
    .from("attendance")
    .select("attendance_date, status")
    .eq("school_id", schoolId)
    .gte("attendance_date", from);

  if (error || !data) return [];

  const byDate = new Map<string, AttendancePoint>();
  for (const row of data as unknown as {
    attendance_date: string;
    status: AttendanceStatus;
  }[]) {
    let p = byDate.get(row.attendance_date);
    if (!p) {
      p = { date: row.attendance_date, present: 0, absent: 0, late: 0, excused: 0 };
      byDate.set(row.attendance_date, p);
    }
    p[row.status] += 1;
  }

  const out: AttendancePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = isoDaysAgo(i);
    const d = new Date(date + "T00:00:00Z");
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    out.push(byDate.get(date) ?? { date, present: 0, absent: 0, late: 0, excused: 0 });
  }
  return out;
}

export type ClassAttendanceRate = {
  classId: string;
  className: string;
  recorded: number;
  present: number;
  rate: number; // 0..100
};

export async function getClassAttendanceRates(
  schoolId: string,
  days = 30
): Promise<ClassAttendanceRate[]> {
  const supabase = await createClient();
  const from = isoDaysAgo(days);
  const { data, error } = await supabase
    .from("attendance")
    .select("status, classes(id, name), classroom_id")
    .eq("school_id", schoolId)
    .gte("attendance_date", from)
    .not("classroom_id", "is", null);

  if (error || !data) return [];

  const map = new Map<string, ClassAttendanceRate>();
  for (const row of data as unknown as {
    status: AttendanceStatus;
    classroom_id: string | null;
    classes: { id: string; name: string } | null;
  }[]) {
    const cls = row.classroom_id ? row.classes : null;
    if (!cls) continue;
    let c = map.get(cls.id);
    if (!c) {
      c = { classId: cls.id, className: cls.name, recorded: 0, present: 0, rate: 0 };
      map.set(cls.id, c);
    }
    c.recorded += 1;
    if (row.status === "present") c.present += 1;
  }

  return Array.from(map.values())
    .map((c) => ({
      ...c,
      rate: c.recorded > 0 ? Math.round((c.present / c.recorded) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate || a.className.localeCompare(b.className));
}

export type SubjectAverage = {
  subjectId: string;
  subjectName: string;
  average: number; // 0..100
  count: number;
};

export async function getSubjectAverages(schoolId: string): Promise<SubjectAverage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_grade_stats")
    .select("subject_id, subject_name, grade_count, avg_norm")
    .eq("school_id", schoolId);

  if (error || !data) return [];
  const map = new Map<string, { id: string; name: string; sum: number; count: number }>();
  for (const row of data as unknown as {
    subject_id: string;
    subject_name: string;
    grade_count: number;
    avg_norm: number | null;
  }[]) {
    const cur = map.get(row.subject_id) ?? { id: row.subject_id, name: row.subject_name, sum: 0, count: 0 };
    cur.sum += (row.avg_norm ?? 0) * row.grade_count;
    cur.count += row.grade_count;
    map.set(row.subject_id, cur);
  }
  return Array.from(map.values())
    .map((s) => ({
      subjectId: s.id,
      subjectName: s.name,
      average: s.count > 0 ? Math.round(s.sum / s.count) : 0,
      count: s.count,
    }))
    .sort((a, b) => b.average - a.average);
}

export type ClassAverage = {
  classId: string;
  className: string;
  average: number; // 0..100
  count: number;
};

export async function getClassAverages(schoolId: string): Promise<ClassAverage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_grade_stats")
    .select("class_id, class_name, grade_count, avg_norm")
    .eq("school_id", schoolId)
    .not("class_id", "is", null);

  if (error || !data) return [];
  const map = new Map<string, { id: string; name: string; sum: number; count: number }>();
  for (const row of data as unknown as {
    class_id: string | null;
    class_name: string | null;
    grade_count: number;
    avg_norm: number | null;
  }[]) {
    if (!row.class_id || !row.class_name) continue;
    const cur = map.get(row.class_id) ?? { id: row.class_id, name: row.class_name, sum: 0, count: 0 };
    cur.sum += (row.avg_norm ?? 0) * row.grade_count;
    cur.count += row.grade_count;
    map.set(row.class_id, cur);
  }
  return Array.from(map.values())
    .map((c) => ({
      classId: c.id,
      className: c.name,
      average: c.count > 0 ? Math.round(c.sum / c.count) : 0,
      count: c.count,
    }))
    .sort((a, b) => b.average - a.average);
}
