import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/types/enums";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
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
      p = {
        date: row.attendance_date,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      };
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

export type ClassAttendance = {
  classId: string;
  className: string;
  recorded: number;
  present: number;
  rate: number; // 0..100
};

/**
 * Attendance rate per class over the last `days` days.
 */
export async function getClassAttendanceRates(
  schoolId: string,
  days = 30
): Promise<ClassAttendance[]> {
  const supabase = await createClient();
  const from = isoDaysAgo(days);
  const { data, error } = await supabase
    .from("attendance")
    .select("status, classes(id, name), classroom_id")
    .eq("school_id", schoolId)
    .gte("attendance_date", from)
    .not("classroom_id", "is", null);

  if (error || !data) return [];

  const map = new Map<string, ClassAttendance>();
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
    .map((c) => ({ ...c, rate: c.recorded > 0 ? Math.round((c.present / c.recorded) * 100) : 0 }))
    .sort((a, b) => b.rate - a.rate || a.className.localeCompare(b.className));
}

export type SubjectAverage = {
  subjectId: string;
  subjectName: string;
  average: number; // 0..100
  count: number;
};

/**
 * Weighted score average per subject (relative to 20 by convention).
 */
export async function getSubjectAverages(schoolId: string): Promise<SubjectAverage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grades")
    .select("score, max_score, subject_id, subjects(id, name)")
    .eq("school_id", schoolId);

  if (error || !data) return [];

  const map = new Map<string, { id: string; name: string; sum: number; count: number }>();
  for (const row of data as unknown as {
    score: number;
    max_score: number;
    subject_id: string;
    subjects: { id: string; name: string } | null;
  }[]) {
    if (!row.subjects || row.max_score <= 0) continue;
    const norm = (row.score / row.max_score) * 100;
    let s = map.get(row.subjects.id);
    if (!s) {
      s = { id: row.subjects.id, name: row.subjects.name, sum: 0, count: 0 };
      map.set(row.subjects.id, s);
    }
    s.sum += norm;
    s.count += 1;
  }

  return Array.from(map.values())
    .map((s) => ({ subjectId: s.id, subjectName: s.name, average: Math.round(s.sum / s.count), count: s.count }))
    .sort((a, b) => b.average - a.average);
}

export type ClassAverage = {
  classId: string;
  className: string;
  average: number; // 0..100
  count: number;
};

/**
 * Average grade per class.
 */
export async function getClassAverages(schoolId: string): Promise<ClassAverage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grades")
    .select("score, max_score, classroom_id, classes(id, name)")
    .eq("school_id", schoolId)
    .not("classroom_id", "is", null);

  if (error || !data) return [];

  const map = new Map<string, { id: string; name: string; sum: number; count: number }>();
  for (const row of data as unknown as {
    score: number;
    max_score: number;
    classroom_id: string | null;
    classes: { id: string; name: string } | null;
  }[]) {
    if (!row.classes || row.max_score <= 0) continue;
    const norm = (row.score / row.max_score) * 100;
    let s = map.get(row.classes.id);
    if (!s) {
      s = { id: row.classes.id, name: row.classes.name, sum: 0, count: 0 };
      map.set(row.classes.id, s);
    }
    s.sum += norm;
    s.count += 1;
  }

  return Array.from(map.values())
    .map((c) => ({ classId: c.id, className: c.name, average: Math.round(c.sum / c.count), count: c.count }))
    .sort((a, b) => b.average - a.average);
}