"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

const classSchema = z.object({
  schoolId: z.string().uuid(),
  name: z.string().min(1, "Nom de classe requis"),
  gradeLevel: z.string().optional().nullable(),
  academicYearId: z.string().uuid().optional().nullable(),
});

const classUpdateSchema = classSchema.extend({ classId: z.string().uuid() });

export type Result = { error?: string; ok?: boolean };

async function requireAdmin(schoolId: string) {
  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };
  const membership = session.memberships.find(
    (m) => m.school_id === schoolId
  );
  if (!membership || membership.role !== "SCHOOL_ADMIN") {
    return { error: "Accès refusé" };
  }
  return session;
}

export async function createClass(
  input: z.infer<typeof classSchema>
): Promise<Result> {
  const parsed = classSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const session = await requireAdmin(parsed.data.schoolId);
  if ("error" in session) return session as Result;

  const supabase = await createClient();
  const { error } = await supabase.from("classes").insert({
    school_id: parsed.data.schoolId,
    name: parsed.data.name,
    grade_level: parsed.data.gradeLevel || null,
    academic_year_id: parsed.data.academicYearId || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/app/admin/classes");
  revalidatePath("/app/admin");
  return { ok: true };
}

export async function updateClass(
  input: z.infer<typeof classUpdateSchema>
): Promise<Result> {
  const parsed = classUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const session = await requireAdmin(parsed.data.schoolId);
  if ("error" in session) return session as Result;

  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .update({
      name: parsed.data.name,
      grade_level: parsed.data.gradeLevel || null,
      academic_year_id: parsed.data.academicYearId || null,
    })
    .eq("id", parsed.data.classId)
    .eq("school_id", parsed.data.schoolId);

  if (error) return { error: error.message };
  revalidatePath("/app/admin/classes");
  return { ok: true };
}

export async function deleteClass(
  classId: string,
  schoolId: string
): Promise<Result> {
  const session = await requireAdmin(schoolId);
  if ("error" in session) return session as Result;

  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .delete()
    .eq("id", classId)
    .eq("school_id", schoolId);

  if (error) return { error: error.message };
  revalidatePath("/app/admin/classes");
  return { ok: true };
}

export async function createSubject(
  schoolId: string,
  name: string
): Promise<Result> {
  const session = await requireAdmin(schoolId);
  if ("error" in session) return session as Result;

  const supabase = await createClient();
  const { error } = await supabase
    .from("subjects")
    .insert({ school_id: schoolId, name });
  if (error) return { error: error.message };
  revalidatePath("/app/admin/classes");
  return { ok: true };
}

export async function assignTeacherToClassSubject(
  classId: string,
  subjectId: string,
  teacherId: string | null
): Promise<Result> {
  const supabase = await createClient();
  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };

  const { data: cls } = await supabase
    .from("classes")
    .select("school_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return { error: "Classe introuvable" };

  const membership = session.memberships.find(
    (m) => m.school_id === cls.school_id
  );
  if (!membership || membership.role !== "SCHOOL_ADMIN") {
    return { error: "Accès refusé" };
  }

  const { error } = await supabase.from("class_subjects").upsert(
    { class_id: classId, subject_id: subjectId, teacher_id: teacherId },
    { onConflict: "class_id,subject_id" }
  );
  if (error) return { error: error.message };
  revalidatePath("/app/admin/classes");
  revalidatePath("/app/teacher");
  return { ok: true };
}