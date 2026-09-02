"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

const teacherSchema = z.object({
  schoolId: z.string().uuid(),
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  employeeNumber: z.string().min(1, "N° employé requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
});

export type Result = { error?: string; ok?: boolean };

export async function createTeacher(
  input: z.infer<typeof teacherSchema>
): Promise<Result> {
  const parsed = teacherSchema.safeParse(input);
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

  // If an email is provided, find or create the linked auth user.
  let userId: string | null = null;
  const email = d.email?.trim();
  if (email) {
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing?.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (found) {
      userId = found.id;
    } else {
      const { data: created, error: createErr } =
        await supabase.auth.admin.createUser({
          email,
          password: `${d.employeeNumber}#Edu`,
          email_confirm: true,
          user_metadata: {
            full_name: `${d.firstName} ${d.lastName}`,
            employee_role: "teacher",
          },
        });
      if (createErr) return { error: createErr.message };
      userId = created.user.id;
    }
  }

  const { error } = await supabase.from("teachers").insert({
    school_id: d.schoolId,
    user_id: userId,
    employee_number: d.employeeNumber,
    first_name: d.firstName,
    last_name: d.lastName,
    email: d.email || null,
  });

  if (error) return { error: error.message };

  // Grant the TEACHER membership so RLS lets them in.
  if (userId) {
    await supabase.from("school_members").upsert(
      { user_id: userId, school_id: d.schoolId, role: "TEACHER" },
      { onConflict: "user_id,school_id" }
    );
  }

  revalidatePath("/app/admin/teachers");
  revalidatePath("/app/admin");
  return { ok: true };
}

export async function deleteTeacher(
  teacherId: string,
  schoolId: string
): Promise<Result> {
  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };
  const membership = session.memberships.find((m) => m.school_id === schoolId);
  if (!membership || membership.role !== "SCHOOL_ADMIN") {
    return { error: "Accès refusé" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("teachers")
    .delete()
    .eq("id", teacherId)
    .eq("school_id", schoolId);

  if (error) return { error: error.message };
  revalidatePath("/app/admin/teachers");
  return { ok: true };
}

const updateSchema = z.object({
  schoolId: z.string().uuid(),
  teacherId: z.string().uuid(),
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

/**
 * Updates a teacher's details.
 */
export async function updateTeacher(
  input: z.infer<typeof updateSchema>
): Promise<Result> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;

  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };
  const membership = session.memberships.find((m) => m.school_id === d.schoolId);
  if (!membership || membership.role !== "SCHOOL_ADMIN") {
    return { error: "Accès refusé" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("teachers")
    .update({
      first_name: d.firstName,
      last_name: d.lastName,
      email: d.email || null,
      phone: d.phone || null,
    })
    .eq("id", d.teacherId)
    .eq("school_id", d.schoolId);

  if (error) return { error: error.message };
  revalidatePath("/app/admin/teachers");
  return { ok: true };
}

/**
 * Activates / deactivates a teacher. Deactivating also removes the
 * TEACHER membership so the account can no longer access the school.
 */
export async function toggleTeacherActive(
  teacherId: string,
  schoolId: string
): Promise<Result> {
  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };
  const membership = session.memberships.find((m) => m.school_id === schoolId);
  if (!membership || membership.role !== "SCHOOL_ADMIN") {
    return { error: "Accès refusé" };
  }

  const supabase = await createClient();

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, user_id, is_active")
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!teacher) return { error: "Enseignant introuvable" };

  const nextActive = !teacher.is_active;

  const { error } = await supabase
    .from("teachers")
    .update({ is_active: nextActive })
    .eq("id", teacherId)
    .eq("school_id", schoolId);

  if (error) return { error: error.message };

  // Sync membership so a deactivated teacher loses access.
  if (teacher.user_id) {
    if (nextActive) {
      await supabase.from("school_members").upsert(
        { user_id: teacher.user_id, school_id: schoolId, role: "TEACHER" },
        { onConflict: "user_id,school_id" }
      );
    } else {
      await supabase
        .from("school_members")
        .delete()
        .eq("user_id", teacher.user_id)
        .eq("school_id", schoolId)
        .eq("role", "TEACHER");
    }
  }

  revalidatePath("/app/admin/teachers");
  return { ok: true };
}