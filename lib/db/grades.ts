import { createClient } from "@/lib/supabase/server";

export type GradeEntry = {
  id: string;
  student_id: string;
  subject_id: string;
  subject_name: string;
  title: string;
  score: number;
  max_score: number;
  coefficient: number;
  grade_date: string;
};

/**
 * Returns the recent grades for a set of students with the subject name.
 */
export async function getStudentsGrades(
  studentIds: string[],
  limit = 20
): Promise<GradeEntry[]> {
  if (studentIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grades")
    .select("id, student_id, subject_id, title, score, max_score, coefficient, grade_date, subjects(name)")
    .in("student_id", studentIds)
    .order("grade_date", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as unknown as {
    id: string;
    student_id: string;
    subject_id: string;
    title: string;
    score: number;
    max_score: number;
    coefficient: number;
    grade_date: string;
    subjects: { name: string } | null;
  }[]).map((g) => ({
    id: g.id,
    student_id: g.student_id,
    subject_id: g.subject_id,
    subject_name: g.subjects?.name ?? "—",
    title: g.title,
    score: g.score,
    max_score: g.max_score,
    coefficient: g.coefficient,
    grade_date: g.grade_date,
  }));
}
