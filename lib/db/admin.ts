import { createClient } from "@/lib/supabase/server";

export type AdminStats = {
  students: number;
  activeStudents: number;
  teachers: number;
  activeTeachers: number;
  parents: number;
  classes: number;
  subjects: number;
  currentAcademicYear: string | null;
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

  const [
    students,
    activeStudents,
    teachers,
    activeTeachers,
    parents,
    classes,
    subjects,
    academicYear,
    attendance,
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active"),
    supabase
      .from("teachers")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("teachers")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("is_active", true),
    supabase
      .from("parents")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("subjects")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("academic_years")
      .select("id, name")
      .eq("school_id", schoolId)
      .eq("is_current", true)
      .maybeSingle(),
    supabase
      .from("attendance")
      .select("status")
      .eq("school_id", schoolId)
      .eq("attendance_date", today),
  ]);

  const rows = attendance.data ?? [];
  return {
    students: students.count ?? 0,
    activeStudents: activeStudents.count ?? 0,
    teachers: teachers.count ?? 0,
    activeTeachers: activeTeachers.count ?? 0,
    parents: parents.count ?? 0,
    classes: classes.count ?? 0,
    subjects: subjects.count ?? 0,
    currentAcademicYear:
      (academicYear.data as unknown as { name: string } | null)?.name ?? null,
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