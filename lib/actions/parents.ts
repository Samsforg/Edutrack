"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { writeBlockMessage } from "@/lib/billing/access";

const parentSchema = z.object({
  schoolId: z.string().uuid(),
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

const parentUpdateSchema = parentSchema.extend({ parentId: z.string().uuid() });

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
/**
 * Creates a parent in the school's directory.
 */
export async function createParent(
  input: z.infer<typeof parentSchema>
): Promise<Result> {
  const parsed = parentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;

  const session = await requireAdmin(d.schoolId);
  if ("error" in session) return session as Result;

  const supabase = await createClient();
  const { error } = await supabase.from("parents").insert({
    school_id: d.schoolId,
    first_name: d.firstName,
    last_name: d.lastName,
    email: d.email || null,
    phone: d.phone || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/app/admin/parents");
  return { ok: true };
}

/**
 * Updates a parent's details in the school's directory.
 */
export async function updateParent(
  input: z.infer<typeof parentUpdateSchema>
): Promise<Result> {
  const parsed = parentUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;

  const session = await requireAdmin(d.schoolId);
  if ("error" in session) return session as Result;

  const supabase = await createClient();
  const { error } = await supabase
    .from("parents")
    .update({
      first_name: d.firstName,
      last_name: d.lastName,
      email: d.email || null,
      phone: d.phone || null,
    })
    .eq("id", d.parentId)
    .eq("school_id", d.schoolId);

  if (error) return { error: error.message };

  revalidatePath("/app/admin/parents");
  return { ok: true };
}