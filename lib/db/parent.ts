import { createClient } from "@/lib/supabase/server";
import type { ParentChild, ParentChildDetail } from "@/types/parent";

type ParentRow = {
  id: string;
  school_id: string;
  student_parents: {
    student_id: string;
    students: {
      id: string;
      first_name: string;
      last_name: string;
      matricule: string;
      status: string;
      classes: { name: string } | null;
      schools: { name: string } | null;
    };
  }[];
};

/**
 * Returns the children linked to the given parent user within any school,
 * along with their current class. RLS (`parent_of_student`) guarantees we
 * only ever read the caller's own children.
 */
export async function getParentChildren(userId: string): Promise<ParentChild[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parents")
    .select(
      "id, school_id, student_parents(student_id, students(id, first_name, last_name, matricule, status, classes(name), schools(name)))"
    )
    .eq("user_id", userId);

  if (error || !data) return [];

  const seen = new Set<string>();
  const children: ParentChild[] = [];

  for (const p of data as unknown as ParentRow[]) {
    for (const sp of p.student_parents ?? []) {
      if (seen.has(sp.student_id)) continue;
      seen.add(sp.student_id);
      children.push({
        student_id: sp.student_id,
        student_first_name: sp.students.first_name,
        student_last_name: sp.students.last_name,
        matricule: sp.students.matricule,
        class_name: sp.students.classes?.name ?? null,
        school_name: sp.students.schools?.name ?? null,
        status: sp.students.status as ParentChild["status"],
      });
    }
  }

  return children;
}

/**
 * Full detail of one of the parent's own children.
 * RLS: a parent who is not linked to the student gets null.
 */
export async function getParentChildDetail(
  studentId: string
): Promise<ParentChildDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select(
      `id, matricule, first_name, last_name, gender, status,
       birth_date, enrollment_date,
       classes(name, academic_years(name)),
       schools(name, email, phone, city, address)`
    )
    .eq("id", studentId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as {
    id: string;
    matricule: string;
    first_name: string;
    last_name: string;
    gender: string | null;
    status: string;
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
    } | null;
  };

  return {
    student_id: row.id,
    student_first_name: row.first_name,
    student_last_name: row.last_name,
    matricule: row.matricule,
    class_name: row.classes?.name ?? null,
    school_name: row.schools?.name ?? null,
    status: row.status as ParentChildDetail["status"],
    birth_date: row.birth_date,
    gender: row.gender,
    enrollment_date: row.enrollment_date,
    school_email: row.schools?.email ?? null,
    school_phone: row.schools?.phone ?? null,
    school_city: row.schools?.city ?? null,
    school_address: row.schools?.address ?? null,
    academic_year_name: row.classes?.academic_years?.name ?? null,
  };
}