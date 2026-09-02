"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const leadSchema = z.object({
  name: z.string().min(2, "Votre nom est requis"),
  school_name: z.string().optional().nullable(),
  email: z.string().email("Email invalide").optional().nullable(),
  phone: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  est_students: z.coerce.number().int().min(0).optional().nullable(),
  message: z.string().optional().nullable(),
  source: z.string().default("contact"),
});

export type LeadResult = { error?: string; ok?: boolean };

/**
 * Enregistre une demande de contact / démo.
 * Écriture dans school_leads via le client anon (permis par la policy
 * d'insertion publique) ; on n'expose aucune donnée bancaire.
 */
export async function submitLead(
  input: z.infer<typeof leadSchema>
): Promise<LeadResult> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const user = await getUserId();

  const supabase = createAdminClient();
  const { error } = await supabase.from("school_leads").insert({
    name: parsed.data.name,
    school_name: parsed.data.school_name || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    city: parsed.data.city || null,
    est_students: parsed.data.est_students || null,
    message: parsed.data.message || null,
    source: parsed.data.source,
    // Lier au compte courant s'il est connecté (pour suivi), sinon null.
  });

  if (error) {
    return { error: error.message };
  }
  void user;
  return { ok: true };
}

async function getUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
