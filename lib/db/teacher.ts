import { createClient } from "@/lib/supabase/server";

export type TeacherClass = {
  class_id: string;
  class_name: string;
  school_id: string;
  subjects: { subject_id: string; subject_name: string }[];
};

/**
 * Returns the classes (with subjects) a teacher is assigned to.
 */
export async function getTeacherClasses(userId: string): Promise<TeacherClass[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teachers")
    .select(
      "id, school_id, class_subjects(class_id, subject_id, classes(id, name), subjects(id, name))"
    )
    .eq("user_id", userId);

  if (error || !data) return [];

  const classes = new Map<string, TeacherClass>();
  for (const t of data as unknown as {
    school_id: string;
    class_subjects: {
      class_id: string;
      subject_id: string;
      classes: { id: string; name: string } | null;
      subjects: { id: string; name: string } | null;
    }[];
  }[]) {
    for (const cs of t.class_subjects ?? []) {
      if (cs.classes && cs.subjects) {
        const cid = cs.class_id;
        if (!classes.has(cid)) {
          classes.set(cid, {
            class_id: cid,
            class_name: cs.classes.name,
            school_id: t.school_id,
            subjects: [],
          });
        }
        classes.get(cid)!.subjects.push({
          subject_id: cs.subject_id,
          subject_name: cs.subjects.name,
        });
      }
    }
  }
  return Array.from(classes.values());
}

/**
 * Returns the list of students in a class.
 */
export async function getClassStudents(
  classId: string
): Promise<
  {
    id: string;
    matricule: string;
    first_name: string;
    last_name: string;
  }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, matricule, first_name, last_name")
    .eq("classroom_id", classId)
    .order("last_name", { ascending: true });

  if (error || !data) return [];
  return data;
}

/**
 * Returns the subjects taught in a class.
 */
export async function getClassSubjects(
  classId: string
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_subjects")
    .select("subject_id, subjects(id, name)")
    .eq("class_id", classId);

  if (error || !data) return [];

  return (data as unknown as {
    subjects: { id: string; name: string } | null;
  }[])
    .map((cs) => cs.subjects)
    .filter((s): s is { id: string; name: string } => s !== null);
}