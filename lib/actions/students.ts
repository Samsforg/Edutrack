"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import type { StudentStatus } from "@/types/enums";

const studentSchema = z.object({
  schoolId: z.string().uuid(),
  classroomId: z.string().uuid().nullable().optional(),
  matricule: z.string().min(1, "Matricule requis"),
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  birthDate: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
});

export type SaveStudentResult = { error?: string; ok?: boolean };

/**
 * Creates a student. The school id is resolved from the session.
 */
export async function createStudent(
  input: z.infer<typeof studentSchema>
): Promise<SaveStudentResult> {
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;

  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };

  const membership = session.memberships.find(
    (m) => m.school_id === d.schoolId
  );
  if (!membership || membership.role !== "SCHOOL_ADMIN") {
    return { error: "Accès refusé" };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("students").insert({
    school_id: d.schoolId,
    classroom_id: d.classroomId || null,
    matricule: d.matricule,
    first_name: d.firstName,
    last_name: d.lastName,
    birth_date: d.birthDate || null,
    gender: d.gender || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/app/admin");
  revalidatePath("/app/admin/students");
  return { ok: true };
}

export async function updateStudent(
  studentId: string,
  input: z.infer<typeof studentSchema>
): Promise<SaveStudentResult> {
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;

  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };

  const membership = session.memberships.find(
    (m) => m.school_id === d.schoolId
  );
  if (!membership || membership.role !== "SCHOOL_ADMIN") {
    return { error: "Accès refusé" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({
      classroom_id: d.classroomId || null,
      matricule: d.matricule,
      first_name: d.firstName,
      last_name: d.lastName,
      birth_date: d.birthDate || null,
      gender: d.gender || null,
    })
    .eq("id", studentId)
    .eq("school_id", d.schoolId);

  if (error) return { error: error.message };

  revalidatePath("/app/admin/students");
  return { ok: true };
}

export async function deleteStudent(
  studentId: string,
  schoolId: string
): Promise<SaveStudentResult> {
  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };

  const membership = session.memberships.find((m) => m.school_id === schoolId);
  if (!membership || membership.role !== "SCHOOL_ADMIN") {
    return { error: "Accès refusé" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", studentId)
    .eq("school_id", schoolId);

  if (error) return { error: error.message };

  revalidatePath("/app/admin/students");
  return { ok: true };
}

const statusSchema = z.object({
  studentId: z.string().uuid(),
  schoolId: z.string().uuid(),
  status: z.enum(["active", "inactive", "graduated", "transferred"]),
});

/**
 * Updates the lifecycle status of a student.
 */
export async function updateStudentStatus(
  input: z.infer<typeof statusSchema>
): Promise<SaveStudentResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;

  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };

  const membership = session.memberships.find(
    (m) => m.school_id === d.schoolId
  );
  if (!membership || membership.role !== "SCHOOL_ADMIN") {
    return { error: "Accès refusé" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({ status: d.status as StudentStatus })
    .eq("id", d.studentId)
    .eq("school_id", d.schoolId);

  if (error) return { error: error.message };

  revalidatePath("/app/admin/students");
  return { ok: true };
}