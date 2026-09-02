/**
 * EduTrack — Vérifier la sécurité RLS imports/analytics (Phase 6).
 *
 * Vérifie l'isolation multi-tenant sur `import_jobs`, les vues analytics
 * (`school_kpis`, `student_attendance_stats`, `school_grade_stats`,
 * `class_attendance_stats`) et l'accès aux données d'import.
 *
 * Prérequis : migrations 0015/0016 appliquées, vars d'env (.env.local),
 * comptes démo créés (seed).
 *
 * Usage : npx tsx scripts/import-security-check.ts
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

async function login(c: SupabaseClient, email: string, password: string): Promise<string> {
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login ${email}: ${error.message}`);
  return data.session?.user.id ?? "";
}

async function getSchoolId(code: string): Promise<string | null> {
  const { data } = await serviceClient.from("schools").select("id").eq("code", code).maybeSingle();
  return data?.id ?? null;
}

async function main() {
  console.log("\nVérification sécurité imports/analytics (RLS)\n");

  const demoId = await getSchoolId("DEMO");
  if (!demoId) throw new Error("École DEMO introuvable (seed ?).");
  const schoolId = demoId;

  const adminC = anonClient();
  const otherAdminC = anonClient();
  const otherTeacherC = anonClient();
  const parentC = anonClient();

  const adminId = await login(adminC, "admin@demo.edutrack", "demo-admin1!");

  // ---- Second school (VERIFY6) + cross-tenant accounts ----
  const otherEmail = "iovr@verify.edutrack";
  const otherTeacherEmail = "iotec@verify.edutrack";
  const password = "demo-xsec1!";
  const { data: existing } = await serviceClient.from("schools").select("id").eq("code", "VERIFY6").maybeSingle();
  let otherId = existing?.id ?? null;
  if (!otherId) {
    const { data, error } = await serviceClient
      .from("schools").insert({ name: "Établissement Vérif Imports", code: "VERIFY6" }).select("id").single();
    if (error) throw error;
    otherId = data.id;
  }
  await serviceClient.auth.admin.createUser({
    email: otherEmail, password, email_confirm: true, user_metadata: { full_name: "Admin Vérif Imports" },
  }).catch(async () => undefined);
  await serviceClient.auth.admin.createUser({
    email: otherTeacherEmail, password, email_confirm: true, user_metadata: { full_name: "Teacher Vérif Imports" },
  }).catch(async () => undefined);

  // Resolve both accounts by email via the service role (reliable).
  const { data: all } = await serviceClient.auth.admin.listUsers();
  const list = all?.users ?? [];
  const otherAdminUser = list.find((x) => x.email === otherEmail);
  const otherTeacherUser = list.find((x) => x.email === otherTeacherEmail);
  if (otherAdminUser) await serviceClient.auth.admin.updateUserById(otherAdminUser.id, { password, email_confirm: true });
  if (otherTeacherUser) await serviceClient.auth.admin.updateUserById(otherTeacherUser.id, { password, email_confirm: true });
  const otherAdminId = otherAdminUser?.id ?? null;
  const otherTeacherId = otherTeacherUser?.id ?? null;
  if (!otherAdminId || !otherTeacherId) throw new Error("Comptes de la 2e école introuvables.");
  await serviceClient.from("school_members").upsert({ user_id: otherAdminId, school_id: otherId, role: "SCHOOL_ADMIN" });
  await serviceClient.from("school_members").upsert({ user_id: otherTeacherId, school_id: otherId, role: "TEACHER" });
  await login(otherAdminC, otherEmail, password);
  await login(otherTeacherC, otherTeacherEmail, password);

  // ---- Fixtures: import_jobs row in DEMO (as admin) ----
  const jobId = crypto.randomUUID();
  const { error: jobIns } = await serviceClient.from("import_jobs").insert({
    id: jobId, school_id: schoolId, user_id: adminId, type: "students",
    status: "completed", total_rows: 1, success_rows: 1, error_rows: 0, file_name: "demo.csv",
  });
  ok("S0: fixture import_jobs créée (service role)", !jobIns, jobIns?.message ?? "");

  // ---- I1: admin can write import_jobs for own school via RLS (anon+RLS) ----
  // The insert policy uses is_admin_of_school(school_id).
  const ownJob = await adminC.from("import_jobs").insert({
    school_id: schoolId, user_id: adminId, type: "teachers",
    status: "completed", total_rows: 0, success_rows: 0, error_rows: 0,
  }).select("id").maybeSingle();
  ok("I1: l'admin peut enregistrer un import pour son école (RLS)", !!ownJob?.data?.id, "insertion bloquée");

  // ---- I2: admin reads own-school import history ----
  const i2 = await adminC.from("import_jobs").select("id").eq("school_id", schoolId).limit(50);
  ok("I2: l'admin lit l'historique d'import de son école", !i2.error && (i2.data ?? []).length >= 1, i2.error?.message ?? "");

  // ---- I3: cross-school admin CANNOT read DEMO import_jobs ----
  const i3 = await otherAdminC.from("import_jobs").select("*").eq("school_id", schoolId);
  ok("I3: un admin d'une autre école ne lit pas les imports DEMO", !i3.error && (i3.data ?? []).length === 0, JSON.stringify(i3.data));

  // ---- I4: cross-school admin CANNOT write import_jobs on DEMO ----
  const i4 = await otherAdminC.from("import_jobs").insert({
    school_id: schoolId, user_id: otherAdminId, type: "students",
    status: "completed", total_rows: 0, success_rows: 0, error_rows: 0, file_name: "x.csv",
  });
  ok("I4: un admin d'une autre école ne crée pas d'import DEMO", Boolean(i4.error), "insertion cross-école réussie");

  // ---- I5: a parent cannot create import_jobs ----
  await login(parentC, "parent1@demo.edutrack", "demo-parent1!");
  const p1Id = (await parentC.auth.getUser()).data.user?.id ?? "parent-placeholder";
  const i5 = await parentC.from("import_jobs").insert({
    school_id: schoolId, user_id: p1Id, type: "students",
    status: "completed", total_rows: 0, success_rows: 0, error_rows: 0,
  });
  ok("I5: un parent ne peut pas créer d'import", Boolean(i5.error), "insertion par parent réussie");

  // ---- A1: admin reads analytics KPIs view for own school ----
  const a1 = await adminC.from("school_kpis").select("*").eq("school_id", schoolId);
  ok("A1: l'admin lit les KPIs de son école (security_invoker)", !a1.error, a1.error?.message ?? "");

  // ---- A2: cross-school admin CANNOT read DEMO kpis ----
  const a2 = await otherAdminC.from("school_kpis").select("*").eq("school_id", schoolId);
  ok("A2: un admin d'une autre école ne lit pas les KPIs DEMO", !a2.error && (a2.data ?? []).length === 0, JSON.stringify(a2.data));

  // ---- A3: a parent cannot read the teacher/student analytics views ----
  const a3 = await parentC.from("school_kpis").select("*").eq("school_id", schoolId);
  ok("A3: un parent ne lit pas les KPIs (admin uniquement)", !a3.error && (a3.data ?? []).length === 0, JSON.stringify(a3.data));

  // ---- A4: cross-school admin cannot read DEMO grade stats view ----
  const a4 = await otherAdminC.from("school_grade_stats").select("*").eq("school_id", schoolId);
  ok("A4: un admin d'une autre école ne lit pas les stats de notes DEMO", !a4.error && (a4.data ?? []).length === 0, JSON.stringify(a4.data));

  // ---- A5: cross-school admin cannot read DEMO student attendance stats view ----
  const a5 = await otherAdminC.from("student_attendance_stats").select("*").eq("school_id", schoolId);
  ok("A5: un admin d'une autre école ne lit pas l'assiduité DEMO", !a5.error && (a5.data ?? []).length === 0, JSON.stringify(a5.data));

  // ---- R1: reports source data — cross-school admin cannot read DEMO students/attendance ----
  const r1 = await otherAdminC.from("students").select("id").eq("school_id", schoolId).limit(5);
  ok("R1: un admin d'une autre école ne lit pas les élèves DEMO (source rapports)", !r1.error && (r1.data ?? []).length === 0, JSON.stringify(r1.data));

  const r2 = await otherTeacherC.from("attendance").select("id").eq("school_id", schoolId).limit(5);
  ok("R2: un enseignant d'une autre école ne lit pas l'assiduité DEMO", !r2.error && (r2.data ?? []).length === 0, JSON.stringify(r2.data));

  // ---- Cleanup ----
  await serviceClient.from("import_jobs").delete().eq("id", jobId);
  if (ownJob?.data?.id) await serviceClient.from("import_jobs").delete().eq("id", ownJob.data.id);

  console.log("\n------------------------------------");
  console.log(`Résultat : ${passed} passé(s), ${failed} échec(s)`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Erreur fatale:", e);
  process.exit(1);
});
