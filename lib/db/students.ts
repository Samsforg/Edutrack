import { createClient } from "@/lib/supabase/server";
import type { StudentStatus } from "@/types/enums";

export type StudentListItem = {
  id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  status: StudentStatus;
  class_name: string | null;
  classroom_id: string | null;
};

export type StudentDetail = StudentListItem & {
  birth_date: string | null;
  enrollment_date: string;
  school: {
    name: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    address: string | null;
  };
  class_school_year: string | null;
  parents: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    user_id: string | null;
  }[];
};

const PAGE_SIZE = 50;

/**
 * Paginated list of students for a school, optionally filtered by
 * class, free-text search or status.
 */
export async function listStudents(
  schoolId: string,
  opts: {
    page?: number;
    classroomId?: string;
    search?: string;
    status?: StudentStatus;
  } = {}
): Promise<{ items: StudentListItem[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(opts.page ?? 0, 0);
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("students")
    .select(
      "id, matricule, first_name, last_name, gender, status, classroom_id, classes(name)",
      { count: "exact" }
    )
    .eq("school_id", schoolId);

  if (opts.classroomId) {
    query = query.eq("classroom_id", opts.classroomId);
  }

  if (opts.status) {
    query = query.eq("status", opts.status);
  }

  if (opts.search) {
    const ilike = `%${opts.search}%`;
    query = query.or(
      `first_name.ilike.${ilike},last_name.ilike.${ilike},matricule.ilike.${ilike}`
    );
  }

  const { data, error, count } = await query
    .order("last_name", { ascending: true })
    .range(from, to);

  if (error || !data) return { items: [], total: 0 };

  const items = (data as unknown as {
    id: string;
    matricule: string;
    first_name: string;
    last_name: string;
    gender: string | null;
    status: StudentStatus;
    classroom_id: string | null;
    classes: { name: string } | null;
  }[]).map((s) => ({
    id: s.id,
    matricule: s.matricule,
    first_name: s.first_name,
    last_name: s.last_name,
    gender: s.gender,
    status: s.status,
    classroom_id: s.classroom_id,
    class_name: s.classes?.name ?? null,
  }));

  return { items, total: count ?? 0 };
}

/**
 * Full detail of a student for a school admin (RLS: admin only).
 * Returns null when the student does not belong to the school.
 */
export async function getStudentDetail(
  schoolId: string,
  studentId: string
): Promise<StudentDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select(
      `id, matricule, first_name, last_name, gender, status, classroom_id,
       birth_date, enrollment_date,
       classes(name, academic_years(name)),
       schools(name, email, phone, city, address, country),
       student_parents(id, parents(id, first_name, last_name, phone, email, user_id))`
    )
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as {
    id: string;
    matricule: string;
    first_name: string;
    last_name: string;
    gender: string | null;
    status: StudentStatus;
    classroom_id: string | null;
    birth_date: string | null;
    enrollment_date: string;
    classes: {
      name: string;
      academic_years: { name: string } | null;
    } | null;
    schools: {
      name: string;
      email: string | null;
      phone: string | null;
      city: string | null;
      address: string | null;
    };
    student_parents: {
      parents: {
        id: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        email: string | null;
        user_id: string | null;
      };
    }[];
  };

  return {
    id: row.id,
    matricule: row.matricule,
    first_name: row.first_name,
    last_name: row.last_name,
    gender: row.gender,
    status: row.status,
    classroom_id: row.classroom_id,
    class_name: row.classes?.name ?? null,
    birth_date: row.birth_date,
    enrollment_date: row.enrollment_date,
    class_school_year: row.classes?.academic_years?.name ?? null,
    school: row.schools,
    parents: (row.student_parents ?? []).map((sp) => sp.parents),
  };
}

/**
 * Lists the active link codes of a student, most recent first
 * (only exposed to school admins through RLS).
 */
export async function listStudentLinkCodes(
  studentId: string
): Promise<
  {
    id: string;
    expires_at: string;
    revoked_at: string | null;
    revoke_reason: string | null;
    used_at: string | null;
    created_at: string;
  }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_link_codes")
    .select("id, expires_at, revoked_at, revoke_reason, used_at, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data as unknown as {
    id: string;
    expires_at: string;
    revoked_at: string | null;
    revoke_reason: string | null;
    used_at: string | null;
    created_at: string;
  }[];
}

/**
 * Lists classes for the school (id + name).
 */
export async function listClassesOptions(schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data;
}