"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { writeBlockMessage } from "@/lib/billing/access";
import { validateAcademicYearDates } from "@/lib/academic-years";

const yearSchema = z.object({
  schoolId: z.string().uuid(),
  name: z.string().min(1, "Nom requis"),
  startDate: z.string().min(1, "Date de début requise"),
  endDate: z.string().min(1, "Date de fin requise"),
});

const yearUpdateSchema = yearSchema.extend({
  yearId: z.string().uuid(),
  isCurrent: z.boolean(),
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
export async function createAcademicYear(
  input: z.infer<typeof yearSchema>
): Promise<Result> {
  const parsed = yearSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;

  const session = await requireAdmin(d.schoolId);
  if ("error" in session) return session as Result;

  const dateError = validateAcademicYearDates(d.startDate, d.endDate);
  if (dateError) return { error: dateError };

  const supabase = await createClient();

  // First new year of a school is flagged as current automatically.
  const { count, error: countErr } = await supabase
    .from("academic_years")
    .select("id", { count: "exact", head: true })
    .eq("school_id", d.schoolId);
  if (countErr) return { error: countErr.message };

  const { error } = await supabase.from("academic_years").insert({
    school_id: d.schoolId,
    name: d.name,
    start_date: d.startDate,
    end_date: d.endDate,
    is_current: (count ?? 0) === 0,
  });
  if (error) return { error: error.message };

  revalidatePath("/app/admin/academic-years");
  revalidatePath("/app/admin");
  return { ok: true };
}

export async function updateAcademicYear(
  input: z.infer<typeof yearUpdateSchema>
): Promise<Result> {
  const parsed = yearUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;

  const session = await requireAdmin(d.schoolId);
  if ("error" in session) return session as Result;

  const dateError = validateAcademicYearDates(d.startDate, d.endDate);
  if (dateError) return { error: dateError };

  const supabase = await createClient();

  if (d.isCurrent) {
    // Unset any other current year of this school, then set this one.
    const { error: unsetErr } = await supabase
      .from("academic_years")
      .update({ is_current: false })
      .eq("school_id", d.schoolId)
      .neq("id", d.yearId);
    if (unsetErr) return { error: unsetErr.message };
  }

  const { error } = await supabase
    .from("academic_years")
    .update({
      name: d.name,
      start_date: d.startDate,
      end_date: d.endDate,
      is_current: d.isCurrent,
    })
    .eq("id", d.yearId)
    .eq("school_id", d.schoolId);

  if (error) return { error: error.message };

  revalidatePath("/app/admin/academic-years");
  revalidatePath("/app/admin");
  return { ok: true };
}

export async function setCurrentAcademicYear(
  yearId: string,
  schoolId: string
): Promise<Result> {
  const session = await requireAdmin(schoolId);
  if ("error" in session) return session as Result;

  const supabase = await createClient();

  const { error: unsetErr } = await supabase
    .from("academic_years")
    .update({ is_current: false })
    .eq("school_id", schoolId);
  if (unsetErr) return { error: unsetErr.message };

  const { error } = await supabase
    .from("academic_years")
    .update({ is_current: true })
    .eq("id", yearId)
    .eq("school_id", schoolId);
  if (error) return { error: error.message };

  revalidatePath("/app/admin/academic-years");
  revalidatePath("/app/admin");
  return { ok: true };
}

export async function deleteAcademicYear(
  yearId: string,
  schoolId: string
): Promise<Result> {
  const session = await requireAdmin(schoolId);
  if ("error" in session) return session as Result;

  const supabase = await createClient();

  const { data: year } = await supabase
    .from("academic_years")
    .select("is_current")
    .eq("id", yearId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (year?.is_current) {
    return { error: "Impossible de supprimer l'année scolaire courante" };
  }

  const { error } = await supabase
    .from("academic_years")
    .delete()
    .eq("id", yearId)
    .eq("school_id", schoolId);

  if (error) return { error: error.message };

  revalidatePath("/app/admin/academic-years");
  revalidatePath("/app/admin");
  return { ok: true };
}