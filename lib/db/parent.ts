import { createClient } from "@/lib/supabase/server";

export type ParentChild = {
  student_id: string;
  student_first_name: string;
  student_last_name: string;
  matricule: string;
  class_name: string | null;
};

type ParentChildrenRow = {
  id: string;
  school_id: string;
  student_parents: {
    student_id: string;
    students: {
      id: string;
      first_name: string;
      last_name: string;
      matricule: string;
      classes: { name: string } | null;
    };
  }[];
}[];

/**
 * Returns the children linked to the given parent user within any school,
 * along with their current class.
 */
export async function getParentChildren(userId: string): Promise<ParentChild[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parents")
    .select(
      "id, school_id, student_parents(student_id, students(id, first_name, last_name, matricule, classes(name)))"
    )
    .eq("user_id", userId);

  if (error || !data) return [];

  const children: ParentChild[] = [];
  for (const p of data as unknown as ParentChildrenRow) {
    for (const sp of p.student_parents ?? []) {
      children.push({
        student_id: sp.student_id,
        student_first_name: sp.students.first_name,
        student_last_name: sp.students.last_name,
        matricule: sp.students.matricule,
        class_name: sp.students.classes?.name ?? null,
      });
    }
  }
  return children;
}
