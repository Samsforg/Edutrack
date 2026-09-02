import { createClient } from "@/lib/supabase/server";
import type { StudentStatus } from "@/types/enums";

export type StudentListItem = {
  id: string;
  matricule: string;
  link_code: string | null;
  first_name: string;
  last_name: string;
  gender: string | null;
  status: StudentStatus;
  class_name: string | null;
  classroom_id: string | null;
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
      "id, matricule, link_code, first_name, last_name, gender, status, classroom_id, classes(name)",
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
      `first_name.ilike.${ilike},last_name.ilike.${ilike},matricule.ilike.${ilike},link_code.ilike.${ilike}`
    );
  }

  const { data, error, count } = await query
    .order("last_name", { ascending: true })
    .range(from, to);

  if (error || !data) return { items: [], total: 0 };

  const items = (data as unknown as {
    id: string;
    matricule: string;
    link_code: string | null;
    first_name: string;
    last_name: string;
    gender: string | null;
    status: StudentStatus;
    classroom_id: string | null;
    classes: { name: string } | null;
  }[]).map((s) => ({
    id: s.id,
    matricule: s.matricule,
    link_code: s.link_code,
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