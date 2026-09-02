import { createClient } from "@/lib/supabase/server";

export type ClassDetail = {
  id: string;
  name: string;
  grade_level: string | null;
  academic_year_id: string | null;
  academic_year_name: string | null;
  student_count: number;
  subjects: {
    subject_id: string;
    subject_name: string;
    teacher_id: string | null;
    teacher_name: string | null;
  }[];
};

/**
 * Lists all classes of a school with student counts and assigned subjects.
 */
export async function listClasses(schoolId: string): Promise<ClassDetail[]> {
  const supabase = await createClient();

  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, grade_level, school_id, academic_year_id, academic_years(name)")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (error || !classes) return [];

  const details: ClassDetail[] = [];

  for (const c of classes) {
    const [countRes, subjectsRes] = await Promise.all([
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("classroom_id", c.id),
      supabase
        .from("class_subjects")
        .select(
          "subject_id, teacher_id, subjects(name), teachers(first_name, last_name)"
        )
        .eq("class_id", c.id),
    ]);

    details.push({
      id: c.id,
      name: c.name,
      grade_level: c.grade_level,
      academic_year_id: (
        c.academic_years as unknown as { id: string } | null
      )?.id ?? null,
      academic_year_name: (
        c.academic_years as unknown as { name: string } | null
      )?.name ?? null,
      student_count: countRes.count ?? 0,
      subjects: (subjectsRes.data ?? []).map((s) => ({
        subject_id: s.subject_id,
        subject_name:
          (s.subjects as unknown as { name: string } | null)?.name ?? "—",
        teacher_id: s.teacher_id,
        teacher_name: s.teachers
          ? `${(s.teachers as unknown as { first_name: string }).first_name} ${
              (s.teachers as unknown as { last_name: string }).last_name
            }`
          : null,
      })),
    });
  }

  return details;
}

/**
 * Lists all teachers of a school (for assignment dropdowns).
 */
export async function listTeachers(schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teachers")
    .select("id, first_name, last_name")
    .eq("school_id", schoolId)
    .order("last_name", { ascending: true });
  if (error || !data) return [];
  return data;
}

/**
 * Lists all subjects of a school.
 */
export async function listSubjects(schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data;
}