import { createClient } from "@/lib/supabase/server";

export type AdminStats = {
  students: number;
  teachers: number;
  parents: number;
  classes: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  excusedToday: number;
};

/**
 * Aggregated numbers for the school admin dashboard.
 */
export async function getAdminStats(schoolId: string): Promise<AdminStats> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [students, teachers, parents, classes, attendance] =
    await Promise.all([
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      supabase
        .from("teachers")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      supabase
        .from("parents")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      supabase
        .from("attendance")
        .select("status")
        .eq("school_id", schoolId)
        .eq("attendance_date", today),
    ]);

  const rows = attendance.data ?? [];
  return {
    students: students.count ?? 0,
    teachers: teachers.count ?? 0,
    parents: parents.count ?? 0,
    classes: classes.count ?? 0,
    presentToday: rows.filter((r) => r.status === "present").length,
    absentToday: rows.filter((r) => r.status === "absent").length,
    lateToday: rows.filter((r) => r.status === "late").length,
    excusedToday: rows.filter((r) => r.status === "excused").length,
  };
}

/**
 * Returns the schools the user administers (SCHOOL_ADMIN role).
 */
export async function getAdminSchools(
  memberships: { school_id: string; role: string }[]
): Promise<string[]> {
  return memberships
    .filter((m) => m.role === "SCHOOL_ADMIN")
    .map((m) => m.school_id);
}