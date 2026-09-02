"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

const rowsSchema = z.array(
  z.object({
    matricule: z.string().min(1, "Matricule requis"),
    firstName: z.string().min(1, "Prénom requis"),
    lastName: z.string().min(1, "Nom requis"),
    className: z.string().optional(),
  })
);

export type ImportResult = {
  ok?: boolean;
  error?: string;
  inserted?: number;
  duplicates?: number;
  invalidRows?: { row: number; reason: string }[];
};

async function requireAdmin(schoolId: string) {
  const session = await getSession();
  if (!session?.user) return null;
  const m = session.memberships.find((m) => m.school_id === schoolId);
  if (!m || m.role !== "SCHOOL_ADMIN") return null;
  return session;
}

/**
 * Validates a batch of student rows and imports them.
 * Never imports without validation; returns per-row errors.
 */
export async function importStudents(
  schoolId: string,
  rows: z.infer<typeof rowsSchema>
): Promise<ImportResult> {
  const session = await requireAdmin(schoolId);
  if (!session) return { error: "Accès refusé" };

  const parsed = rowsSchema.safeParse(rows);
  if (!parsed.success) {
    return { error: "Format de données invalide" };
  }

  const supabase = await createClient();

  // Resolve class names -> ids.
  const classNames = Array.from(
    new Set(parsed.data.map((r) => r.className?.trim()).filter(Boolean))
  ) as string[];
  const { data: classes } = classNames.length
    ? await supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .in("name", classNames)
    : { data: [] as { id: string; name: string }[] };
  const classIdByName = new Map((classes ?? []).map((c) => [c.name, c.id]));
  const missingClasses = new Set(
    classNames.filter((n) => !classIdByName.has(n))
  );

  const invalidRows: ImportResult["invalidRows"] = [];
  parsed.data.forEach((r, i) => {
    if (r.className?.trim() && missingClasses.has(r.className.trim())) {
      invalidRows.push({
        row: i + 2, // +2 for header + index
        reason: `Classe inconnue : ${r.className.trim()}`,
      });
    }
  });

  // Dedupe within the batch by matricule.
  const seen = new Set<string>();
  const toInsert: {
    school_id: string;
    matricule: string;
    first_name: string;
    last_name: string;
    classroom_id: string | null;
  }[] = [];
  let duplicates = 0;

  for (const r of parsed.data) {
    const key = r.matricule.trim();
    if (seen.has(key)) {
      duplicates++;
      invalidRows?.push({ row: -1, reason: `Matricule en double : ${key}` });
      continue;
    }
    seen.add(key);
    toInsert.push({
      school_id: schoolId,
      matricule: key,
      first_name: r.firstName.trim(),
      last_name: r.lastName.trim(),
      classroom_id: r.className?.trim()
        ? classIdByName.get(r.className.trim()) ?? null
        : null,
    });
  }

  if (toInsert.length === 0) {
    return { ok: true, inserted: 0, duplicates, invalidRows };
  }

  // Insert; a unique violation means one or more matricules already exist
  // in the database, in which case we fall back to inserting row by row.
  const { error } = await supabase.from("students").insert(toInsert);

  if (!error) {
    revalidatePath("/app/admin/students");
    revalidatePath("/app/admin");
    return { ok: true, inserted: toInsert.length, duplicates, invalidRows };
  }

  if (!String(error.message).toLowerCase().includes("duplicate")) {
    return { error: error.message };
  }

  let inserted = 0;
  for (const row of toInsert) {
    const { data: rows } = await supabase
      .from("students")
      .insert(row)
      .select("id");
    if (rows && rows.length === 1) inserted++;
    else duplicates++;
  }
  revalidatePath("/app/admin/students");
  revalidatePath("/app/admin");
  return { ok: true, inserted, duplicates, invalidRows };
}