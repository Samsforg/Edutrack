import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/types/database";

export type TodayAttendance = {
  student_id: string;
  status: AttendanceStatus;
};

/**
 * Returns today's attendance records for a class, keyed by student id.
 */
export async function getTodayAttendance(
  classId: string
): Promise<TodayAttendance[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("attendance")
    .select("student_id, status")
    .eq("classroom_id", classId)
    .eq("attendance_date", today);

  if (error || !data) return [];
  return data as TodayAttendance[];
}