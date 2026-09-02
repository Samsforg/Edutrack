import type { AttendanceStatus } from "@/types/enums";

/** A single attendance record for a student on a given day. */
export type AttendanceRecord = {
  id: string;
  school_id: string;
  student_id: string;
  classroom_id: string | null;
  attendance_date: string;
  status: AttendanceStatus;
  check_in: string | null;
  check_out: string | null;
  note: string | null;
  taken_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Lightweight attendance row for lists/history (no school geom). */
export type AttendanceEntry = {
  id: string;
  student_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  check_in: string | null;
  check_out: string | null;
  note: string | null;
};

/** Rolls up all attendance for a class on a date (appel du jour). */
export type ClassAttendance = {
  attendance_date: string;
  /** Map student_id -> status. Students with no row are "non renseigné". */
  entries: Record<string, AttendanceStatus>;
};

/**
 * Aggregated summary for a student (rate + counts), used by the parent
 * follow-up and the admin student presence section.
 */
export type AttendanceSummary = {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  /** Percentage of marked days that are "present" or "excused". */
  rate: number | null;
};

/** Per-student summary row used in the admin student presence section. */
export type StudentAttendanceStats = {
  student_id: string;
  summary: AttendanceSummary;
  recent: AttendanceEntry[];
};