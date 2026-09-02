import { createClient } from "@/lib/supabase/server";

export type TeacherDetail = {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  class_count: number;
  subject_count: number;
};

/**
 * Detailed list of teachers for a school (active and inactive).
 */
export async function listTeachersDetail(
  schoolId: string
): Promise<TeacherDetail[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("teachers")
    .select("id, employee_number, first_name, last_name, email, phone, is_active")
    .eq("school_id", schoolId)
    .order("last_name", { ascending: true });

  if (error || !data) return [];

  const teachers = data as unknown as Omit<
    TeacherDetail,
    "class_count" | "subject_count"
  >[];

  const assignments = await Promise.all(
    teachers.map((t) =>
      supabase
        .from("class_subjects")
        .select("class_id, subject_id")
        .eq("teacher_id", t.id)
    )
  );

  return teachers.map((t, i) => {
    const classes = new Set(assignments[i].data?.map((a) => a.class_id) ?? []);
    const subjects = new Set(
      assignments[i].data?.map((a) => a.subject_id) ?? []
    );
    return { ...t, class_count: classes.size, subject_count: subjects.size };
  });
}