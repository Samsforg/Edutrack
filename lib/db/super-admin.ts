import { createClient } from "@/lib/supabase/server";

export type PlatformStats = {
  schools: number;
  schoolsActive: number;
  members: number;
  teachers: number;
  parents: number;
  students: number;
};

/**
 * Platform-wide statistics for the super admin dashboard.
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const supabase = await createClient();

  const [schools, schoolsActive, members, teachers, parents, students] =
    await Promise.all([
      supabase.from("schools").select("id", { count: "exact", head: true }),
      supabase
        .from("schools")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("school_members")
        .select("id", { count: "exact", head: true }),
      supabase.from("teachers").select("id", { count: "exact", head: true }),
      supabase.from("parents").select("id", { count: "exact", head: true }),
      supabase.from("students").select("id", { count: "exact", head: true }),
    ]);

  return {
    schools: schools.count ?? 0,
    schoolsActive: schoolsActive.count ?? 0,
    members: members.count ?? 0,
    teachers: teachers.count ?? 0,
    parents: parents.count ?? 0,
    students: students.count ?? 0,
  };
}

export type SchoolAdminRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  created_at: string;
  admins: number;
  students: number;
};

/**
 * Basic SaaS list of schools (name, status, admin count).
 */
export async function listSchoolsForSuperAdmin(): Promise<SchoolAdminRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schools")
    .select(
      "id, name, code, status, created_at, school_members(user_id, role), students(id)"
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as unknown as {
    id: string;
    name: string;
    code: string;
    status: string;
    created_at: string;
    school_members: { user_id: string; role: string }[];
    students: unknown[];
  }[]).map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    status: s.status,
    created_at: s.created_at,
    admins: s.school_members.filter((m) => m.role === "SCHOOL_ADMIN").length,
    students: s.students.length,
  }));
}