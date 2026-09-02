import { createClient } from "@/lib/supabase/server";

export type SubjectDetail = {
  id: string;
  name: string;
  code: string | null;
  class_count: number;
  teacher_count: number;
};

/**
 * Lists the subjects of a school with usage counts.
 */
export async function listSubjectsDetail(
  schoolId: string
): Promise<SubjectDetail[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, code")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (error || !data) return [];

  const subjects = data as unknown as SubjectDetail[];

  const assignments = await Promise.all(
    subjects.map((s) =>
      supabase
        .from("class_subjects")
        .select("class_id, teacher_id")
        .eq("subject_id", s.id)
    )
  );

  return subjects.map((s, i) => {
    const classes = new Set(assignments[i].data?.map((a) => a.class_id) ?? []);
    const teachers = new Set(
      assignments[i].data
        ?.map((a) => a.teacher_id)
        .filter((t): t is string => !!t) ?? []
    );
    return {
      id: s.id,
      name: s.name,
      code: s.code,
      class_count: classes.size,
      teacher_count: teachers.size,
    };
  });
}