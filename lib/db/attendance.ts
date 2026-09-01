import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/types/database";

export type AttendanceEntry = {
  id: string;
  student_id: string;
  attendance_date: string;
  status: AttendanceStatus;
};

/**
 * Returns the recent attendance records for a set of students
 * (used on the parent dashboard).
 */
export async function getStudentsAttendance(
  studentIds: string[],
  limitDays = 10
): Promise<AttendanceEntry[]> {
  if (studentIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("id, student_id, attendance_date, status")
    .in("student_id", studentIds)
    .order("attendance_date", { ascending: false })
    .limit(limitDays);

  if (error || !data) return [];
  return data as AttendanceEntry[];
}
