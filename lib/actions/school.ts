"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

const schoolSchema = z.object({
  schoolId: z.string().uuid(),
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
});

export type Result = { error?: string; ok?: boolean };

/**
 * Updates the profile (contact details) of the school.
 * The school id is resolved from the session.
 */
export async function updateSchool(
  input: z.infer<typeof schoolSchema>
): Promise<Result> {
  const parsed = schoolSchema.safeParse(input);
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
    .from("schools")
    .update({
      name: d.name,
      email: d.email || null,
      phone: d.phone || null,
      address: d.address || null,
      city: d.city || null,
      country: d.country || null,
    })
    .eq("id", d.schoolId);

  if (error) return { error: error.message };

  revalidatePath("/app/admin/settings");
  revalidatePath("/app/admin");
  return { ok: true };
}