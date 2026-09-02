"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { writeBlockMessage } from "@/lib/billing/access";

const subjectSchema = z.object({
  schoolId: z.string().uuid(),
  name: z.string().min(1, "Nom requis"),
  code: z.string().min(1, "Code requis").max(20, "Code trop long"),
});

const subjectUpdateSchema = subjectSchema.extend({
  subjectId: z.string().uuid(),
});

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

  const blocked = await writeBlockMessage(schoolId);
  if (blocked) return { error: blocked };

  return session;
}
export async function createSubject(
  input: z.infer<typeof subjectSchema>
): Promise<Result> {
  const parsed = subjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;

  const session = await requireAdmin(d.schoolId);
  if ("error" in session) return session as Result;

  const supabase = await createClient();
  const { error } = await supabase
    .from("subjects")
    .insert({ school_id: d.schoolId, name: d.name, code: d.code.toUpperCase() });

  if (error) {
    if (error.code === "23505") {
      return { error: `Le code « ${d.code} » est déjà utilisé dans cette école` };
    }
    return { error: error.message };
  }

  revalidatePath("/app/admin/subjects");
  revalidatePath("/app/admin/classes");
  return { ok: true };
}

export async function updateSubject(
  input: z.infer<typeof subjectUpdateSchema>
): Promise<Result> {
  const parsed = subjectUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;

  const session = await requireAdmin(d.schoolId);
  if ("error" in session) return session as Result;

  const supabase = await createClient();
  const { error } = await supabase
    .from("subjects")
    .update({
      name: d.name,
      code: d.code.toUpperCase(),
    })
    .eq("id", d.subjectId)
    .eq("school_id", d.schoolId);

  if (error) {
    if (error.code === "23505") {
      return { error: `Le code « ${d.code} » est déjà utilisé dans cette école` };
    }
    return { error: error.message };
  }

  revalidatePath("/app/admin/subjects");
  revalidatePath("/app/admin/classes");
  return { ok: true };
}

export async function deleteSubject(
  subjectId: string,
  schoolId: string
): Promise<Result> {
  const session = await requireAdmin(schoolId);
  if ("error" in session) return session as Result;

  const supabase = await createClient();

  const { count } = await supabase
    .from("class_subjects")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", subjectId);

  if (count && count > 0) {
    return {
      error: `Matière encore assignée à ${count} classe(s). Retirez l'affectation avant de supprimer.`,
    };
  }

  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", subjectId)
    .eq("school_id", schoolId);

  if (error) return { error: error.message };

  revalidatePath("/app/admin/subjects");
  return { ok: true };
}