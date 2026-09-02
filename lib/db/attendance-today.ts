import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/types/database";

export type TodayAttendance = {
  student_id: string;
  status: AttendanceStatus;
  check_in: string | null;
  check_out: string | null;
  note: string | null;
};

/**
 * Returns attendance records for a class on a given date (defaults to today).
 */
export async function getTodayAttendance(
  classId: string,
  date?: string
): Promise<TodayAttendance[]> {
  const supabase = await createClient();
  const day = date ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("attendance")
    .select("student_id, status, check_in, check_out, note")
    .eq("classroom_id", classId)
    .eq("attendance_date", day);

  if (error || !data) return [];
  return data as TodayAttendance[];
}