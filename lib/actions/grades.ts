"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

const gradeSchema = z.object({
  schoolId: z.string().uuid(),
  classId: z.string().uuid(),
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
  title: z.string().min(1, "Titre requis"),
  score: z.coerce.number().min(0, "Note >= 0"),
  maxScore: z.coerce.number().positive("Note maximale > 0"),
  coefficient: z.coerce.number().positive("Coefficient > 0"),
  date: z.string().min(1, "Date requise"),
  comment: z.string().optional(),
});

export type SaveGradeResult = { error?: string; ok?: boolean };

/**
 * Creates a grade. The school id is resolved from the session server-side.
 */
export async function saveGrade(
  input: z.infer<typeof gradeSchema>
): Promise<SaveGradeResult> {
  const parsed = gradeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;
  if (d.score > d.maxScore) {
    return { error: "La note ne peut pas dépasser la note maximale." };
  }

  const session = await getSession();
  if (!session?.user) {
    return { error: "Non authentifié" };
  }

  const membership = session.memberships.find(
    (m) => m.school_id === d.schoolId
  );
  if (!membership || !["SCHOOL_ADMIN", "TEACHER"].includes(membership.role)) {
    return { error: "Accès refusé" };
  }

  const supabase = await createClient();

  // Teacher id for this user, if any.
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("school_id", d.schoolId)
    .maybeSingle();

  const { error } = await supabase.from("grades").insert({
    school_id: d.schoolId,
    student_id: d.studentId,
    subject_id: d.subjectId,
    classroom_id: d.classId,
    teacher_id: teacher?.id ?? null,
    title: d.title,
    score: d.score,
    max_score: d.maxScore,
    coefficient: d.coefficient,
    grade_date: d.date,
    comment: d.comment || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/app/parent");
  revalidatePath("/app/teacher");
  return { ok: true };
}