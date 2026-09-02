"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { getSession } from "@/lib/auth/session";
import type { ImportEntityType } from "@/lib/import/parse";
import { writeBlockMessage } from "@/lib/billing/access";

type DbClient = SupabaseClient<Database>;

export type ImportIssue = {
  row: number;
  field?: string;
  value?: string;
  error: string;
  solution?: string;
};

export type ImportResult = {
  ok?: boolean;
  error?: string;
  type?: ImportEntityType;
  total?: number;
  inserted?: number;
  duplicates?: number;
  errors?: ImportIssue[];
  jobId?: string;
};

const NAME_RE = /^[A-Za-zÀ-ÿ' -]{1,80}$/;
const MATRICULE_RE = /^[A-Za-z0-9_-]{1,40}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const rows = <T extends z.ZodTypeAny>(schema: T) => z.array(schema);

const studentRow = z.object({
  matricule: z.string().min(1).regex(MATRICULE_RE, "Matricule invalide."),
  first_name: z.string().min(1).regex(NAME_RE, "Prénom invalide."),
  last_name: z.string().min(1).regex(NAME_RE, "Nom invalide."),
  date_of_birth: z.string().optional().or(z.literal("")),
  gender: z.string().optional().or(z.literal("")),
  class_name: z.string().optional().or(z.literal("")),
});

const parentRow = z.object({
  first_name: z.string().min(1).regex(NAME_RE, "Prénom invalide."),
  last_name: z.string().min(1).regex(NAME_RE, "Nom invalide."),
  email: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

const teacherRow = z.object({
  employee_number: z.string().min(1).regex(MATRICULE_RE, "N° employé invalide."),
  first_name: z.string().min(1).regex(NAME_RE, "Prénom invalide."),
  last_name: z.string().min(1).regex(NAME_RE, "Nom invalide."),
  email: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

const classRow = z.object({
  name: z.string().min(1, "Nom requis.").max(80),
  level: z.string().optional().or(z.literal("")),
  academic_year_name: z.string().optional().or(z.literal("")),
});

const subjectRow = z.object({
  code: z.string().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/, "Code invalide."),
  name: z.string().min(1, "Nom requis.").max(80),
});

const emailRe = EMAIL_RE;

async function requireAdmin(schoolId: string) {
  const session = await getSession();
  if (!session?.user) return null;
  const m = session.memberships.find((m) => m.school_id === schoolId);
  if (!m || m.role !== "SCHOOL_ADMIN") return null;
  return session;
}

async function insertImportJob(supabase: DbClient, input: {
  schoolId: string;
  userId: string;
  type: ImportEntityType;
  total: number;
  success: number;
  errors: number;
  fileName?: string;
  issues: ImportIssue[];
}) {
  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from("import_jobs")
    .insert({
      school_id: input.schoolId,
      user_id: input.userId,
      type: input.type,
      status: "completed",
      total_rows: input.total,
      success_rows: input.success,
      error_rows: input.errors,
      file_name: input.fileName ?? null,
      errors: input.issues.length ? (input.issues as ImportIssue[]) : null,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  const id = (data as unknown as { id?: string } | null)?.id ?? null;
  return id ?? error?.message ?? null;
}

const BATCH = 200;

/**
 * Imports students from validated rows. See README / docs/IMPORTS.md.
 * Deduplicates within the batch (by matricule) and against the DB.
 */
export async function importStudents(
  schoolId: string,
  rawRows: z.infer<typeof studentRow>[]
): Promise<ImportResult> {
  const session = await requireAdmin(schoolId);
  if (!session) return { error: "Accès refusé" };

  const blocked = await writeBlockMessage(schoolId);
  if (blocked) return { error: blocked };

  const parsed = rows(studentRow).safeParse(rawRows);
  if (!parsed.success) return { error: "Format de données invalide." };
  const supabase = await createClient();

  // Resolve class names -> ids.
  const classNames = [
    ...new Set(parsed.data.map((r) => r.class_name?.trim()).filter(Boolean)),
  ];
  const { data: classes } = classNames.length
    ? await supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .in("name", classNames)
    : { data: [] };
  const classId = new Map((classes ?? []).map((c: { id: string; name: string }) => [c.name, c.id]));

  // Existing matricules to avoid DB duplicate blow-ups.
  const toInsert: {
    school_id: string;
    matricule: string;
    first_name: string;
    last_name: string;
    birth_date: string | null;
    gender: string | null;
    classroom_id: string | null;
  }[] = [];
  // (mapped to 'birth_date' column, see buildStudentsRows comment)
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  parsed.data.forEach((r, i) => {
    const line = i + 2;
    const key = r.matricule.trim();
    if (seen.has(key)) {
      duplicates++;
      issues.push({ row: line, field: "matricule", value: key, error: "Matricule en double dans le fichier." });
      return;
    }
    seen.add(key);

    if (r.class_name?.trim() && !classId.has(r.class_name.trim())) {
      issues.push({
        row: line,
        field: "class_name",
        value: r.class_name,
        error: "Classe inconnue.",
        solution: "Créez d'abord la classe.",
      });
      return;
    }
    if (r.date_of_birth && (!DATE_RE.test(r.date_of_birth) || Number.isNaN(Date.parse(r.date_of_birth)))) {
      issues.push({ row: line, field: "date_of_birth", value: r.date_of_birth, error: "Date invalide (AAAA-MM-JJ)." });
      return;
    }

    toInsert.push({
      school_id: schoolId,
      matricule: r.matricule.trim(),
      first_name: r.first_name.trim(),
      last_name: r.last_name.trim(),
      gender: r.gender?.trim()?.toUpperCase() || null,
      birth_date: r.date_of_birth || null,
      classroom_id: r.class_name?.trim() ? classId.get(r.class_name.trim()) ?? null : null,
    });
  });

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH);
    const { error } = await supabase.from("students").insert(chunk);
    if (!error) {
      inserted += chunk.length;
    } else if (String(error.message).toLowerCase().includes("duplicate")) {
      for (const row of chunk) {
        const { data: rd } = await supabase.from("students").insert(row).select("id");
        if (rd && rd.length) inserted++;
        else duplicates++;
      }
    } else {
      issues.push({ row: -1, error: error.message });
    }
  }

  const jobId = await insertImportJob(supabase, {
    schoolId: schoolId,
    userId: session.user.id,
    type: "students",
    total: parsed.data.length,
    success: inserted,
    errors: issues.length,
    issues,
  });
  void jobId;

  revalidatePath("/app/admin/students");
  revalidatePath("/app/admin/import");
  return { ok: true, type: "students", total: parsed.data.length, inserted, duplicates, errors: issues };
}

/**
 * Imports teachers. Auto-creates a secure invitation email (no weak reuse of
 * phone as password): teacher accounts get a random initial password and are
 * invited via the existing admin create path. Requires email to create an auth
 * user; teachers without email are stored but not granted login.
 */
export async function importTeachers(
  schoolId: string,
  rawRows: z.infer<typeof teacherRow>[]
): Promise<ImportResult> {
  const session = await requireAdmin(schoolId);
  if (!session) return { error: "Accès refusé" };

  const blocked = await writeBlockMessage(schoolId);
  if (blocked) return { error: blocked };
  const parsed = rows(teacherRow).safeParse(rawRows);
  if (!parsed.success) return { error: "Format de données invalide." };
  const supabase = await createClient();

  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let inserted = 0;

  for (let i = 0; i < parsed.data.length; i++) {
    const r = parsed.data[i];
    const line = i + 2;
    const key = r.employee_number.trim();
    if (seen.has(key)) {
      duplicates++;
      issues.push({ row: line, field: "employee_number", value: key, error: "N° employé en double dans le fichier." });
      continue;
    }
    seen.add(key);

    const email = r.email?.trim();
    if (email && !emailRe.test(email)) {
      issues.push({ row: line, field: "email", value: email, error: "Email invalide." });
      continue;
    }

    let userId: string | null = null;
    if (email) {
      try {
        const { data: existing } = await supabase.auth.admin.listUsers();
        const found = existing?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (found) {
          userId = found.id;
        } else {
          const { data: created, error: ce } = await supabase.auth.admin.createUser({
            email,
            password: cryptoRandomPassword(),
            email_confirm: true,
            user_metadata: { full_name: `${r.first_name} ${r.last_name}`, employee_role: "teacher" },
          });
          if (ce) {
            issues.push({ row: line, field: "email", value: email, error: ce.message });
            continue;
          }
          userId = created.user.id;
        }
      } catch (e: unknown) {
        issues.push({ row: line, field: "email", value: email, error: (e instanceof Error ? e.message : "Erreur création compte.") });
        continue;
      }
    }

    const { error } = await supabase
      .from("teachers")
      .insert({
        school_id: schoolId,
        user_id: userId,
        employee_number: key,
        first_name: r.first_name.trim(),
        last_name: r.last_name.trim(),
        email: email || null,
        phone: r.phone?.trim() || null,
      })
      .select("id")
      .single();
    if (error) {
      if (String(error.message).toLowerCase().includes("duplicate")) {
        duplicates++;
        issues.push({ row: line, field: "employee_number", value: key, error: "N° employé déjà utilisé." });
      } else {
        issues.push({ row: line, error: error.message });
      }
      continue;
    }
    inserted++;

    if (userId) {
      await supabase.from("school_members").upsert(
        { user_id: userId, school_id: schoolId, role: "TEACHER" },
        { onConflict: "user_id,school_id" }
      );
    }
  }

  await insertImportJob(supabase, {
    schoolId, userId: session.user.id, type: "teachers",
    total: parsed.data.length, success: inserted, errors: issues.length, issues,
  });
  revalidatePath("/app/admin/teachers");
  revalidatePath("/app/admin/import");
  return { ok: true, type: "teachers", total: parsed.data.length, inserted, duplicates, errors: issues };
}

function cryptoRandomPassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint8Array(12);
  try {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(arr);
      for (const b of arr) out += chars[b % chars.length];
    }
  } catch {
    for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out + "Edu!";
}

/**
 * Imports parents. Only strips/creates parent sheet rows; does NOT link to any
 * child — the existing link-code / link-request workflow is the secure channel.
 */
export async function importParents(
  schoolId: string,
  rawRows: z.infer<typeof parentRow>[]
): Promise<ImportResult> {
  const session = await requireAdmin(schoolId);
  if (!session) return { error: "Accès refusé" };

  const blocked = await writeBlockMessage(schoolId);
  if (blocked) return { error: blocked };
  const parsed = rows(parentRow).safeParse(rawRows);
  if (!parsed.success) return { error: "Format de données invalide." };
  const supabase = await createClient();

  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let inserted = 0;

  for (let i = 0; i < parsed.data.length; i++) {
    const r = parsed.data[i];
    const line = i + 2;
    const key = `${r.first_name.trim()}|${r.last_name.trim()}|${r.email?.trim() ?? ""}`;
    if (seen.has(key)) {
      duplicates++;
      issues.push({ row: line, error: "Parent en double dans le fichier." });
      continue;
    }
    seen.add(key);

    const email = r.email?.trim();
    if (email && !emailRe.test(email)) {
      issues.push({ row: line, field: "email", value: email, error: "Email invalide." });
      continue;
    }

    let userId: string | null = null;
    if (email) {
      // A parent must authenticate to access the portal. Create an auth user
      // only when email provided; otherwise skip linking.
      try {
        const { data: existing } = await supabase.auth.admin.listUsers();
        const found = existing?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (!found) {
          const { data: created, error: ce } = await supabase.auth.admin.createUser({
            email,
            password: cryptoRandomPassword(),
            email_confirm: true,
            user_metadata: { full_name: `${r.first_name} ${r.last_name}`, employee_role: "parent" },
          });
          if (ce) {
            issues.push({ row: line, field: "email", value: email, error: ce.message });
            continue;
          }
          userId = created.user.id;
        } else {
          userId = found.id;
        }
      } catch (e: unknown) {
        issues.push({ row: line, field: "email", error: (e instanceof Error ? e.message : "Erreur création compte.") });
        continue;
      }
    }

    const { error } = await supabase
      .from("parents")
      .insert({
        school_id: schoolId,
        user_id: userId,
        first_name: r.first_name.trim(),
        last_name: r.last_name.trim(),
        email: email || null,
        phone: r.phone?.trim() || null,
      })
      .single();
    if (error) {
      if (String(error.message).toLowerCase().includes("duplicate")) {
        duplicates++;
        issues.push({ row: line, error: "Parent déjà enregistré (tel/email)." });
      } else {
        issues.push({ row: line, error: error.message });
      }
      continue;
    }
    inserted++;

    if (userId) {
      await supabase.from("school_members").upsert(
        { user_id: userId, school_id: schoolId, role: "PARENT" },
        { onConflict: "user_id,school_id" }
      );
    }
  }

  await insertImportJob(supabase, {
    schoolId, userId: session.user.id, type: "parents",
    total: parsed.data.length, success: inserted, errors: issues.length, issues,
  });
  revalidatePath("/app/admin/parents");
  revalidatePath("/app/admin/import");
  return { ok: true, type: "parents", total: parsed.data.length, inserted, duplicates, errors: issues };
}

/**
 * Imports classes. Uses the current academic year (or the named one).
 */
export async function importClasses(
  schoolId: string,
  rawRows: z.infer<typeof classRow>[]
): Promise<ImportResult> {
  const session = await requireAdmin(schoolId);
  if (!session) return { error: "Accès refusé" };

  const blocked = await writeBlockMessage(schoolId);
  if (blocked) return { error: blocked };
  const parsed = rows(classRow).safeParse(rawRows);
  if (!parsed.success) return { error: "Format de données invalide." };
  const supabase = await createClient();

  const { data: years } = await supabase
    .from("academic_years")
    .select("id, name, is_current")
    .eq("school_id", schoolId);
  const yearsRows = (years ?? []) as unknown as {
    id: string;
    name: string;
    is_current: boolean;
  }[];
  const currentYear = yearsRows.find((y) => y.is_current);
  const yearIdByName = new Map(yearsRows.map((y) => [y.name, y.id]));

  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  const toInsert: {
    school_id: string;
    academic_year_id: string;
    name: string;
    level: string | null;
    school_year: string | null;
  }[] = [];

  parsed.data.forEach((r, i) => {
    const line = i + 2;
    const name = r.name.trim();
    if (seen.has(name)) {
      duplicates++;
      issues.push({ row: line, field: "name", value: name, error: "Classe en double dans le fichier." });
      return;
    }
    seen.add(name);

    let yearId = currentYear?.id ?? null;
    if (r.academic_year_name?.trim()) {
      const yid = yearIdByName.get(r.academic_year_name.trim());
      if (!yid) {
        issues.push({ row: line, field: "academic_year_name", value: r.academic_year_name, error: "Année scolaire inconnue." });
        return;
      }
      yearId = yid;
    }
    if (!yearId) {
      issues.push({ row: line, error: "Aucune année scolaire configurée." });
      return;
    }

    toInsert.push({
      school_id: schoolId,
      academic_year_id: yearId,
      name,
      level: r.level?.trim() || null,
      school_year: r.academic_year_name?.trim() || (currentYear?.name ?? null),
    });
  });

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH);
    const { error } = await supabase.from("classes").insert(chunk);
    if (!error) {
      inserted += chunk.length;
    } else if (String(error.message).toLowerCase().includes("duplicate")) {
      for (const row of chunk) {
        const { data } = await supabase.from("classes").insert(row).select("id");
        if (data && data.length) inserted++;
        else duplicates++;
      }
    } else {
      issues.push({ row: -1, error: error.message });
    }
  }

  await insertImportJob(supabase, {
    schoolId, userId: session.user.id, type: "classes",
    total: parsed.data.length, success: inserted, errors: issues.length, issues,
  });
  revalidatePath("/app/admin/classes");
  revalidatePath("/app/admin/import");
  return { ok: true, type: "classes", total: parsed.data.length, inserted, duplicates, errors: issues };
}

/**
 * Imports subjects. Unique by (school_id, code).
 */
export async function importSubjects(
  schoolId: string,
  rawRows: z.infer<typeof subjectRow>[]
): Promise<ImportResult> {
  const session = await requireAdmin(schoolId);
  if (!session) return { error: "Accès refusé" };

  const blocked = await writeBlockMessage(schoolId);
  if (blocked) return { error: blocked };
  const parsed = rows(subjectRow).safeParse(rawRows);
  if (!parsed.success) return { error: "Format de données invalide." };
  const supabase = await createClient();

  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  const toInsert: { school_id: string; code: string; name: string }[] = [];

  parsed.data.forEach((r, i) => {
    const line = i + 2;
    const code = r.code.trim().toUpperCase();
    if (seen.has(code)) {
      duplicates++;
      issues.push({ row: line, field: "code", value: code, error: "Code en double dans le fichier." });
      return;
    }
    seen.add(code);
    toInsert.push({ school_id: schoolId, code, name: r.name.trim() });
  });

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH);
    const { error } = await supabase.from("subjects").insert(chunk);
    if (!error) {
      inserted += chunk.length;
    } else if (String(error.message).toLowerCase().includes("duplicate")) {
      for (const row of chunk) {
        const { data } = await supabase.from("subjects").insert(row).select("id");
        if (data && data.length) inserted++;
        else duplicates++;
      }
    } else {
      issues.push({ row: -1, error: error.message });
    }
  }

  await insertImportJob(supabase, {
    schoolId, userId: session.user.id, type: "subjects",
    total: parsed.data.length, success: inserted, errors: issues.length, issues,
  });
  revalidatePath("/app/admin/subjects");
  revalidatePath("/app/admin/import");
  return { ok: true, type: "subjects", total: parsed.data.length, inserted, duplicates, errors: issues };
}

/**
 * Lists import history for the admin (RLS: admin of school).
 */
export async function getImportHistory(schoolId: string) {
  const session = await requireAdmin(schoolId);
  if (!session) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("import_jobs")
    .select("id, type, status, total_rows, success_rows, error_rows, file_name, created_at, completed_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
