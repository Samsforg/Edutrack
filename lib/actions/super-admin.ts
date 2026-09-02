"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guard";

const schoolSchema = z.object({
  name: z.string().min(1, "Nom d’établissement requis"),
  code: z
    .string()
    .min(2, "Code requis")
    .max(20)
    .transform((v) => v.toUpperCase()),
});

export type Result = { error?: string; ok?: boolean };

export async function createSchool(
  input: z.infer<typeof schoolSchema>
): Promise<Result> {
  const parsed = schoolSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const session = await requireRole(["SUPER_ADMIN"]);
  void session;

  const supabase = await createClient();
  const { error } = await supabase.from("schools").insert({
    name: parsed.data.name,
    code: parsed.data.code,
    status: "active",
  });
  if (error) {
    if (error.code === "23505") {
      return { error: "Ce code d’établissement existe déjà." };
    }
    return { error: error.message };
  }

  revalidatePath("/app/super-admin");
  return { ok: true };
}