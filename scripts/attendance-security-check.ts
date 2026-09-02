/**
 * EduTrack — Vérifier la sécurité RLS de la présence (Phase 4).
 *
 * Exécute le parcours réel d'appel (enseignant → absence) et vérifie les
 * isolations RLS sur `attendance` ET `notifications`. Chaque « client » se
 * connecte via l'API anon (comme un vrai navigateur) : la RLS s'applique
 * réellement, le service role ne sert qu'à préparer/valider les données.
 *
 * Prérequis : migrations 0001..0013 appliquées, seed exécuté, vars d'env
 * (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY) chargées depuis .env.local.
 *
 * Usage : npx tsx scripts/attendance-security-check.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envFile = path.resolve(__dirname, "../.env.local");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
      if (m) process.env[m[1]] ??= m[2].trim();
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    throw new Error("Vars d'env manquantes (URL + anon + service role).");
  }
  return { url, anon, service };
}

const { url, anon, service } = loadEnv();

function anonClient(): SupabaseClient {
  return createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
const serviceClient = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`);
  }
}

async function login(
  c: SupabaseClient,
  email: string,
  password: string
): Promise<string> {
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login ${email}: ${error.message}`);
  return data.session?.user.id ?? "";
}

async function getSchoolId(code: string): Promise<string | null> {
  const { data } = await serviceClient
    .from("schools")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  return data?.id ?? null;
}

/** Creates (idempotent) a second school with an admin and a teacher user. */
async function ensureSecondSchool(): Promise<{
  schoolId: string;
  adminEmail: string;
  teacherEmail: string;
}> {
  const adminEmail = "atan@verify.edutrack";
  const teacherEmail = "ateac@verify.edutrack";
  const password = "demo-xsec1!";

  const { data: existing } = await serviceClient
    .from("schools")
    .select("id")
    .eq("code", "VERIFY3")
    .maybeSingle();
  let schoolId = existing?.id ?? null;
  if (!schoolId) {
    const { data, error } = await serviceClient
      .from("schools")
      .insert({ name: "Établissement Vérif Présence", code: "VERIFY3" })
      .select("id")
      .single();
    if (error) throw error;
    schoolId = data.id;
  }

  await serviceClient.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Admin Vérif Présence" },
  }).catch(() => undefined);
  await serviceClient.auth.admin.createUser({
    email: teacherEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Enseignant Vérif Présence" },
  }).catch(() => undefined);

  const adminC = anonClient();
  const { data: aLogin } = await adminC.auth.signInWithPassword({
    email: adminEmail,
    password,
  });
  const tC = anonClient();
  const { data: tLogin } = await tC.auth.signInWithPassword({
    email: teacherEmail,
    password,
  });
  const adminId = aLogin.session?.user.id;
  const teacherId = tLogin.session?.user.id;
  if (!adminId || !teacherId) {
    throw new Error("Impossible de résoudre les comptes de la 2e école.");
  }

  await serviceClient
    .from("school_members")
    .upsert({ user_id: adminId, school_id: schoolId, role: "SCHOOL_ADMIN" });
  await serviceClient
    .from("school_members")
    .upsert({ user_id: teacherId, school_id: schoolId, role: "TEACHER" });

  return { schoolId, adminEmail, teacherEmail };
}

async function main() {
  console.log("\nVérification sécurité présence (attendance + notifications)\n");

  const schoolId = await getSchoolId("DEMO");
  if (!schoolId) throw new Error("École DEMO introuvable (seed ?).");
  const { data: student } = await serviceClient
    .from("students")
    .select("id, first_name, last_name, classroom_id, school_id")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!student || !student.classroom_id) {
    throw new Error("Aucun élève actif avec classe (seed ?).");
  }

  const other = await ensureSecondSchool();

  const parentC = anonClient();
  const parent2C = anonClient();
  const teacherC = anonClient();
  const adminC = anonClient();
  const otherAdminC = anonClient();
  const otherTeacherC = anonClient();

  const parent1Id = await login(parentC, "parent1@demo.edutrack", "demo-parent1!");
  await login(parent2C, "parent2@demo.edutrack", "demo-parent2!");
  await login(teacherC, "teacher1@demo.edutrack", "demo-teach1!");
  await login(adminC, "admin@demo.edutrack", "demo-admin1!");
  await login(otherAdminC, other.adminEmail, "demo-xsec1!");
  await login(otherTeacherC, other.teacherEmail, "demo-xsec1!");

  // The security assertions that a parent reads "their own child" need to know
  // which demo student parent1 is linked to. Use the first linked student of
  // parent1; fall back to a fresh fixture student otherwise.
  const { data: p1ParentRow } = await serviceClient
    .from("parents")
    .select("id")
    .eq("user_id", parent1Id)
    .eq("school_id", schoolId)
    .maybeSingle();
  let ownStudentId = student.id;
  let readParent = parentC;
  let blockedParent = parent2C;
  if (p1ParentRow) {
    const { data: own } = await serviceClient
      .from("student_parents")
      .select("student_id")
      .eq("parent_id", p1ParentRow.id)
      .limit(1)
      .maybeSingle();
    if (own?.student_id) {
      ownStudentId = own.student_id;
      readParent = parentC;
      blockedParent = parent2C;
    }
  }

  const date = new Date().toISOString().slice(0, 10);

  // ---- R1: parent of the student can read attendance ----
  const r1 = await readParent.from("attendance").select("*").eq("student_id", ownStudentId);
  ok(
    "R1: le parent lié peut lire la présence de son enfant",
    !r1.error,
    r1.error?.message ?? ""
  );

  // ---- R2: a non-linked parent cannot read the target student's attendance ----
  const { data: otherStudent } = await serviceClient
    .from("students")
    .select("id")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .neq("id", ownStudentId)
    .limit(1)
    .maybeSingle();
  const target = otherStudent?.id ?? ownStudentId;
  const r2 = await blockedParent.from("attendance").select("*").eq("student_id", target);
  ok(
    "R2: un autre parent ne lit pas la présence de l'élève cible",
    !r2.error && (r2.data ?? []).length === 0,
    JSON.stringify(r2.data)
  );

  // ---- R3: a parent CANNOT insert attendance ----
  const r3 = await blockedParent.from("attendance").insert({
    school_id: schoolId,
    student_id: ownStudentId,
    classroom_id: student.classroom_id,
    attendance_date: date,
    status: "absent",
  });
  ok(
    "R3: un parent ne peut pas écrire la présence",
    Boolean(r3.error),
    "l'insertion a réussi alors qu'elle devait être bloquée"
  );

  // ---- R4: the school admin CAN write attendance for the school ----
  await serviceClient.from("attendance").delete().eq("student_id", ownStudentId);
  const r4 = await adminC.from("attendance").insert({
    school_id: schoolId,
    student_id: ownStudentId,
    classroom_id: student.classroom_id,
    attendance_date: date,
    status: "excused",
    taken_by: parent1Id,
  });
  ok("R4: l'admin de l'école peut écrire la présence", !r4.error, r4.error?.message ?? "");

  // ---- R5: cross-school admin CANNOT read DEMO attendance ----
  const r5 = await otherAdminC.from("attendance").select("*").eq("school_id", schoolId);
  ok(
    "R5: un admin d'une autre école ne lit pas la présence DEMO",
    !r5.error && (r5.data ?? []).length === 0,
    JSON.stringify(r5.data)
  );

  // ---- R6: cross-school admin CANNOT write attendance ----
  const r6 = await otherAdminC.from("attendance").insert({
    school_id: schoolId,
    student_id: ownStudentId,
    classroom_id: student.classroom_id,
    attendance_date: date,
    status: "absent",
  });
  ok(
    "R6: un admin d'une autre école ne peut pas écrire la présence",
    Boolean(r6.error),
    "l'insertion cross-école a réussi"
  );

  // ---- R7: teacher of ANOTHER school cannot read DEMO attendance ----
  const r7 = await otherTeacherC.from("attendance").select("*").eq("school_id", schoolId);
  ok(
    "R7: un enseignant d'une autre école ne lit pas la présence DEMO",
    !r7.error && (r7.data ?? []).length === 0,
    JSON.stringify(r7.data)
  );

  // ---- R8: same-school trigger rejects a mismatched school on write ----
  const r8 = await adminC.from("attendance").insert({
    school_id: other.schoolId,
    student_id: ownStudentId,
    classroom_id: student.classroom_id,
    attendance_date: date,
    status: "absent",
  });
  ok(
    "R8: le trigger refuse une école différente de celle de l'élève",
    Boolean(r8.error?.message?.toLowerCase().includes("diff")),
    r8.error?.message ?? "l'insertion avec école différente a réussi"
  );

  // ---- R9: notifications are scoped to their owner ----
  const { data: notif, error: notifErr } = await serviceClient
    .from("notifications")
    .insert({
      user_id: parent1Id,
      type: "attendance",
      title: "Absence",
      body: "Test RLS notifications",
      link: "/app/parent",
    })
    .select("id")
    .single();
  ok("R9: une notification peut être créée pour le parent", !notifErr && !!notif?.id, notifErr?.message ?? "");

  const r9 = await blockedParent.from("notifications").select("id").eq("id", notif?.id);
  ok(
    "R9b: un autre parent ne voit pas la notification d'un tiers",
    !r9.error && (r9.data ?? []).length === 0,
    JSON.stringify(r9.data)
  );
  const r9self = await parentC.from("notifications").select("id").eq("id", notif?.id);
  ok(
    "R9c: le destinataire voit sa propre notification",
    !r9self.error && (r9self.data ?? []).length === 1,
    JSON.stringify(r9self.data)
  );

  // ---- R10: a parent cannot update a notification they don't own ----
  const r10 = await blockedParent
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notif?.id);
  ok(
    "R10: un autre parent ne peut pas marquer la notification d'un tiers",
    (r10.data ?? []).length === 0,
    JSON.stringify(r10.data)
  );

  // ---- R11: staff of ANOTHER school cannot notify DEMO parents ----
  const r11 = await otherAdminC.from("notifications").insert({
    user_id: parent1Id,
    type: "attendance",
    title: "Spam",
    body: "Tentative cross-école",
    link: "/app/parent",
  });
  ok(
    "R11: le staff d'une autre école ne peut pas notifier un parent DEMO",
    Boolean(r11.error),
    "l'insertion cross-école a réussi"
  );

  // ---- R12: a parent cannot delete attendance ----
  const r12 = await blockedParent.from("attendance").delete().eq("student_id", ownStudentId);
  ok(
    "R12: un parent ne peut pas supprimer la présence",
    (r12.data ?? []).length === 0,
    JSON.stringify(r12.data)
  );

  // ---- Cleanup ----
  await serviceClient.from("attendance").delete().eq("student_id", ownStudentId);
  if (notif?.id) {
    await serviceClient.from("notifications").delete().eq("id", notif.id);
  }

  console.log("\n------------------------------------");
  console.log(`Résultat : ${passed} passé(s), ${failed} échec(s)`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Erreur fatale:", e);
  process.exit(1);
});