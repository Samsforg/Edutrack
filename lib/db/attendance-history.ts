import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/types/enums";
import type {
  AttendanceEntry,
  AttendanceSummary,
  ClassAttendance,
} from "@/types/attendance";

export type TeacherHistoryRow = AttendanceEntry & {
  class_name: string | null;
  student_name: string;
};

/**
 * Historical attendance for a set of students (used for the parent child
 * follow-up and the admin student presence section). RLS keeps it scoped.
 */
export async function getStudentsAttendanceHistory(
  studentIds: string[],
  from: string,
  to: string
): Promise<AttendanceEntry[]> {
  if (studentIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("id, student_id, attendance_date, status, check_in, check_out, note")
    .in("student_id", studentIds)
    .gte("attendance_date", from)
    .lte("attendance_date", to)
    .order("attendance_date", { ascending: false })
    .limit(500);

  if (error || !data) return [];
  return data as AttendanceEntry[];
}

/**
 * Attendance summary (counts + rate) for a single student over a date range.
 */
export async function getStudentAttendanceSummary(
  studentId: string,
  from: string,
  to: string
): Promise<AttendanceSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("status")
    .eq("student_id", studentId)
    .gte("attendance_date", from)
    .lte("attendance_date", to);

  if (error) {
    return { total: 0, present: 0, absent: 0, late: 0, excused: 0, rate: null };
  }

  const rows = (data ?? []) as { status: AttendanceStatus }[];
  return summarize(rows);
}

/** Pure helper, exported for unit tests. */
export function summarize(
  rows: { status: AttendanceStatus }[]
): AttendanceSummary {
  const summary: AttendanceSummary = {
    total: rows.length,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    rate: null,
  };
  for (const r of rows) {
    if (r.status === "present") summary.present++;
    else if (r.status === "absent") summary.absent++;
    else if (r.status === "late") summary.late++;
    else if (r.status === "excused") summary.excused++;
  }
  const marked = summary.present + summary.excused;
  summary.rate = rows.length > 0 ? Math.round((marked / rows.length) * 100) : null;
  return summary;
}

/**
 * Today's status for a student (null if not recorded yet). RLS restricts
 * parents to their own children.
 */
export async function getTodayStatusForStudent(
  studentId: string,
  date: string
): Promise<AttendanceEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("id, student_id, attendance_date, status, check_in, check_out, note")
    .eq("student_id", studentId)
    .eq("attendance_date", date)
    .maybeSingle();
  if (error || !data) return null;
  return data as AttendanceEntry;
}

/**
 * Today's statuses for a set of students (parent dashboard "Aujourd'hui").
 */
export async function getTodayStatusesForStudents(
  studentIds: string[],
  date: string
): Promise<AttendanceEntry[]> {
  if (studentIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("id, student_id, attendance_date, status, check_in, check_out, note")
    .in("student_id", studentIds)
    .eq("attendance_date", date);
  if (error || !data) return [];
  return data as AttendanceEntry[];
}

/**
 * Whether any attendance has been recorded for a class on a given date
 * (used by the teacher dashboard "Appel effectué / non effectué").
 */
export async function hasClassAttendance(
  classId: string,
  date: string
): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("classroom_id", classId)
    .eq("attendance_date", date);
  return (count ?? 0) > 0;
}

/**
 * Loads a class' full attendance for a date (all statuses), used by the
 * teacher attendance form. Returns students of the class with their status.
 */
export async function getClassAttendanceForDate(
  classId: string,
  date: string
): Promise<ClassAttendance> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance")
    .select("student_id, status")
    .eq("classroom_id", classId)
    .eq("attendance_date", date);
  const entries: Record<string, AttendanceStatus> = {};
  for (const r of data ?? ([] as { student_id: string; status: AttendanceStatus }[])) {
    entries[r.student_id] = r.status;
  }
  return { attendance_date: date, entries };
}

export type StudentAttendanceToday = {
  student_id: string;
  matricule: string;
  student_name: string;
  status: AttendanceStatus | null;
  check_in: string | null;
};

/**
 * Today's attendance for all active students of a school, including those
 * WITHOUT a record yet (status null = "non renseigné"). RLS scopes to the
 * school. Used by the admin dashboard.
 */
export async function getSchoolTodayAttendance(
  schoolId: string,
  date: string
): Promise<StudentAttendanceToday[]> {
  const supabase = await createClient();
  const todayRows = await supabase
    .from("attendance")
    .select("student_id, status, check_in")
    .eq("school_id", schoolId)
    .eq("attendance_date", date);

  const byId = new Map<string, { status: AttendanceStatus; check_in: string | null }>();
  for (const r of (todayRows.data ?? []) as {
    student_id: string;
    status: AttendanceStatus;
    check_in: string | null;
  }[]) {
    byId.set(r.student_id, r);
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, matricule, first_name, last_name")
    .eq("school_id", schoolId)
    .eq("status", "active");

  return (students ?? [])
    .map((s) => {
      const row = byId.get(s.id);
      return {
        student_id: s.id,
        matricule: s.matricule,
        student_name: `${s.last_name} ${s.first_name}`,
        status: row?.status ?? null,
        check_in: row?.check_in ?? null,
      };
    })
    .sort((a, b) => (a.status == null ? -1 : b.status == null ? 1 : 0));
}

/**
 * Historical attendance for a teacher's own classes, with class + student
 * names (used by /app/teacher/attendance/history).
 */
export async function getTeacherAttendanceHistory(
  classIds: string[],
  dateFrom: string | null,
  dateTo: string | null
): Promise<TeacherHistoryRow[]> {
  if (classIds.length === 0) return [];
  const supabase = await createClient();
  let q = supabase
    .from("attendance")
    .select(
      "id, student_id, attendance_date, status, check_in, check_out, note, classroom_id, students(id, first_name, last_name), classes(id, name)"
    )
    .in("classroom_id", classIds)
    .order("attendance_date", { ascending: false })
    .limit(500);

  if (dateFrom) q = q.gte("attendance_date", dateFrom);
  if (dateTo) q = q.lte("attendance_date", dateTo);

  const { data, error } = await q;
  if (error || !data) return [];

  return (data as Array<{
    id: string;
    student_id: string;
    attendance_date: string;
    status: AttendanceStatus;
    check_in: string | null;
    check_out: string | null;
    note: string | null;
    students: { id: string; first_name: string; last_name: string }[];
    classes: { id: string; name: string }[];
  }>).map((r) => {
    const student = r.students?.[0];
    const cls = r.classes?.[0];
    return {
      id: r.id,
      student_id: r.student_id,
      attendance_date: r.attendance_date,
      status: r.status,
      check_in: r.check_in,
      check_out: r.check_out,
      note: r.note,
      student_name: student
        ? `${student.first_name} ${student.last_name}`
        : "—",
      class_name: cls?.name ?? null,
    };
  });
}