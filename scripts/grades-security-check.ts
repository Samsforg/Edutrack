/**
 * EduTrack — Vérifier la sécurité RLS des notes/évaluations (Phase 5).
 *
 * Exécute les parcours réels de lecture/écriture sur `grades`, `assessments`,
 * `academic_periods` et `announcements` via l'API anon (RLS réelle). Le service
 * role ne sert qu'à préparer les fixtures et valider les données.
 *
 * Prérequis : migration 0014 appliquée, vars d'env chargées (URL + anon +
 * service role) depuis .env.local. Comptes démo créés (admin/teacher/parents).
 *
 * Usage : npx tsx scripts/grades-security-check.ts
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

async function ensureSecondSchool(): Promise<{ schoolId: string; adminEmail: string; teacherEmail: string }> {
  const adminEmail = "gver@verify.edutrack";
  const teacherEmail = "gteac@verify.edutrack";
  const password = "demo-xsec1!";

  const { data: existing } = await serviceClient.from("schools").select("id").eq("code", "VERIFY5").maybeSingle();
  let schoolId = existing?.id ?? null;
  if (!schoolId) {
    const { data, error } = await serviceClient
      .from("schools")
      .insert({ name: "Établissement Vérif Notes", code: "VERIFY5" })
      .select("id")
      .single();
    if (error) throw error;
    schoolId = data.id;
  }

  await serviceClient.auth.admin.createUser({
    email: adminEmail, password, email_confirm: true,
    user_metadata: { full_name: "Admin Vérif Notes" },
  }).catch(() => undefined);
  await serviceClient.auth.admin.createUser({
    email: teacherEmail, password, email_confirm: true,
    user_metadata: { full_name: "Enseignant Vérif Notes" },
  }).catch(() => undefined);

  const adminC = anonClient();
  const { data: aLogin } = await adminC.auth.signInWithPassword({ email: adminEmail, password });
  const tC = anonClient();
  const { data: tLogin } = await tC.auth.signInWithPassword({ email: teacherEmail, password });
  const adminId = aLogin.session?.user.id;
  const teacherId = tLogin.session?.user.id;
  if (!adminId || !teacherId) throw new Error("Impossible de résoudre les comptes de la 2e école.");

  await serviceClient.from("school_members").upsert({ user_id: adminId, school_id: schoolId, role: "SCHOOL_ADMIN" });
  await serviceClient.from("school_members").upsert({ user_id: teacherId, school_id: schoolId, role: "TEACHER" });

  return { schoolId, adminEmail, teacherEmail };
}

async function main() {
  console.log("\nVérification sécurité notes/évaluations/annonces (RLS)\n");

  const schoolId = await getSchoolId("DEMO");
  if (!schoolId) throw new Error("École DEMO introuvable (seed ?).");

  // Resolve the demo teacher + first subject/class, and an assessment subject the teacher teaches.
  // Resolve a class + subject for the fixtures (use the first active student's class).
  const { data: student } = await serviceClient
    .from("students").select("id, classroom_id").eq("school_id", schoolId).eq("status", "active").limit(1).maybeSingle();
  if (!student) throw new Error("Aucun élève actif (seed ?).");
  if (!student.classroom_id) throw new Error("L'élève actif n'a pas de classe (seed ?).");

  const { data: classSub } = await serviceClient
    .from("class_subjects")
    .select("class_id, subject_id, teacher_id")
    .eq("class_id", student.classroom_id)
    .limit(1)
    .maybeSingle();
  if (!classSub) throw new Error("Aucune matière assignée à la classe de l'élève (seed ?).");
  const teacherId = classSub.teacher_id;

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

  // Which student is parent1 linked to (own child)?
  const { data: p1ParentRow } = await serviceClient
    .from("parents").select("id").eq("user_id", parent1Id).eq("school_id", schoolId).maybeSingle();
  let ownStudentId = student.id as string;
  if (p1ParentRow) {
    const { data: own } = await serviceClient
      .from("student_parents").select("student_id").eq("parent_id", p1ParentRow.id).limit(1).maybeSingle();
    if (own?.student_id) ownStudentId = own.student_id;
  } else if (teacherId) {
    // Fallback fixture: link parent1 to the first student.
    const { data: par } = await serviceClient
      .from("parents").insert({ user_id: parent1Id, school_id: schoolId }).select("id").single();
    if (par?.id) await serviceClient.from("student_parents").upsert({ parent_id: par.id, student_id: ownStudentId });
  }

  // ---- Fixtures: create one published assessment+grade and one draft assessment+grade ----
  const nowIso = new Date().toISOString();
  const publishedAssessmentId = crypto.randomUUID();
  const draftAssessmentId = crypto.randomUUID();

  // Academic period fixture (idempotent) — assessments require one.
  const yearRes = await serviceClient
    .from("academic_years").select("id").eq("school_id", schoolId).limit(1).maybeSingle();
  if (!yearRes.data) throw new Error("Aucune année scolaire pour l'école DEMO (seed ?).");
  const { data: periodRes } = await serviceClient
    .from("academic_periods").select("id").eq("school_id", schoolId).eq("name", "RLS Trimestre").maybeSingle();
  const periodId =
    periodRes?.id ??
    (
      await serviceClient.from("academic_periods").insert({
        school_id: schoolId, academic_year_id: yearRes.data.id, name: "RLS Trimestre",
        type: "trimester", start_date: "2026-09-01", end_date: "2026-12-20", is_current: true,
      }).select("id").single()
    ).data!.id;

  const { error: insPubA } = await serviceClient.from("assessments").insert({
    id: publishedAssessmentId, school_id: schoolId, class_id: classSub.class_id,
    subject_id: classSub.subject_id, teacher_id: teacherId, title: "RLS Publié",
    max_score: 20, coefficient: 1, published: true, academic_period_id: periodId,
  });
  const { error: insDraftA } = await serviceClient.from("assessments").insert({
    id: draftAssessmentId, school_id: schoolId, class_id: classSub.class_id,
    subject_id: classSub.subject_id, teacher_id: teacherId, title: "RLS Brouillon",
    max_score: 20, coefficient: 1, published: false, academic_period_id: periodId,
  });
  if (insPubA || insDraftA) {
    console.error("  fixture assessments insert error:", insPubA?.message, insDraftA?.message);
  }

  const { error: insPubG } = await serviceClient.from("grades").insert({
    school_id: schoolId, student_id: ownStudentId, subject_id: classSub.subject_id,
    classroom_id: student.classroom_id, teacher_id: teacherId, title: "RLS Publié",
    score: 16, max_score: 20, coefficient: 1, assessment_id: publishedAssessmentId, published_at: nowIso,
  });
  const { error: insDraftG } = await serviceClient.from("grades").insert({
    school_id: schoolId, student_id: ownStudentId, subject_id: classSub.subject_id,
    classroom_id: student.classroom_id, teacher_id: teacherId, title: "RLS Brouillon",
    score: 5, max_score: 20, coefficient: 1, assessment_id: draftAssessmentId, published_at: null,
  });
  if (insPubG || insDraftG) {
    console.error("  fixture grades insert error:", insPubG?.message, insDraftG?.message);
  }

  // ---- G1: parent reads only PUBLISHED grades of own child ----
  const g1 = await parentC.from("grades").select("*").eq("student_id", ownStudentId);
  type GradeRow = { assessment_id: string | null };
  const publishedRows = (g1.data ?? []).filter((g: GradeRow) => g.assessment_id === publishedAssessmentId);
  const draftRows = (g1.data ?? []).filter((g: GradeRow) => g.assessment_id === draftAssessmentId);
  ok("G1: le parent lié lit la note publiée de son enfant", !g1.error && publishedRows.length === 1, JSON.stringify(publishedRows));
  ok("G1b: le parent ne voit PAS la note en brouillon (non publiée)", (g1.data ?? []).length === 1 || draftRows.length === 0, JSON.stringify(g1.data));

  // ---- G2: a non-linked parent cannot read own-child grades ----
  const g2 = await parent2C.from("grades").select("*").eq("student_id", ownStudentId).eq("assessment_id", publishedAssessmentId);
  ok("G2: un autre parent ne lit pas les notes de l'élève cible", !g2.error && (g2.data ?? []).length === 0, JSON.stringify(g2.data));

  // ---- G3: a parent CANNOT write grades (even published) ----
  const g3 = await parentC.from("grades").insert({
    school_id: schoolId, student_id: ownStudentId, subject_id: classSub.subject_id,
    classroom_id: student.classroom_id, teacher_id: teacherId, title: "X",
    score: 10, max_score: 20, coefficient: 1, assessment_id: publishedAssessmentId, published_at: nowIso,
  });
  ok("G3: un parent ne peut pas écrire de note", Boolean(g3.error), "l'insertion a réussi");

  // ---- G4: admin of the school CAN read grades (all states) ----
  const g4 = await adminC.from("grades").select("*").eq("school_id", schoolId).limit(5);
  ok("G4: l'admin de l'école peut lire les notes (brouillon inclus)", !g4.error && (g4.data ?? []).length > 0, g4.error?.message ?? "");

  // ---- G5: cross-school admin CANNOT read DEMO grades ----
  const g5 = await otherAdminC.from("grades").select("*").eq("school_id", schoolId);
  ok("G5: un admin d'une autre école ne lit pas les notes DEMO", !g5.error && (g5.data ?? []).length === 0, JSON.stringify(g5.data));

  // ---- G6: cross-school admin CANNOT write DEMO grades ----
  const g6 = await otherAdminC.from("grades").insert({
    school_id: schoolId, student_id: ownStudentId, subject_id: classSub.subject_id,
    classroom_id: student.classroom_id, teacher_id: teacherId, title: "X",
    score: 10, max_score: 20, coefficient: 1, assessment_id: publishedAssessmentId, published_at: nowIso,
  });
  ok("G6: un admin d'une autre école ne peut pas écrire de note", Boolean(g6.error), "l'insertion cross-école a réussi");

  // ---- G7: teacher of ANOTHER school cannot read DEMO grades ----
  const g7 = await otherTeacherC.from("grades").select("*").eq("school_id", schoolId);
  ok("G7: un enseignant d'une autre école ne lit pas les notes DEMO", !g7.error && (g7.data ?? []).length === 0, JSON.stringify(g7.data));

  // ---- A1: assessments — parent reads only published assessments ----
  const a1 = await parentC.from("assessments").select("*").eq("school_id", schoolId).in("id", [publishedAssessmentId, draftAssessmentId]);
  const a1Ids = (a1.data ?? []).map((x: { id: string }) => x.id);
  ok("A1: le parent ne lit que les évaluations publiées", !a1.error && a1Ids.includes(publishedAssessmentId) && !a1Ids.includes(draftAssessmentId), JSON.stringify(a1Ids));

  // ---- A2: cross-school admin cannot read assessments ----
  const a2 = await otherAdminC.from("assessments").select("*").eq("school_id", schoolId);
  ok("A2: un admin d'une autre école ne lit pas les évaluations DEMO", !a2.error && (a2.data ?? []).length === 0, JSON.stringify(a2.data));

  // ---- P1: academic_periods — admin can read, cross-school cannot ----
  const p1 = await adminC.from("academic_periods").select("*").eq("school_id", schoolId);
  const p2 = await otherAdminC.from("academic_periods").select("*").eq("school_id", schoolId);
  ok("P1: l'admin lit les périodes de son école", !p1.error, p1.error?.message ?? "");
  ok("P1b: un admin d'une autre école ne lit pas les périodes DEMO", !p2.error && (p2.data ?? []).length === 0, JSON.stringify(p2.data));

  // ---- N1: announcements — parent reads published, not drafts, not archived ----
  const annId = crypto.randomUUID();
  const draftAnnId = crypto.randomUUID();
  await serviceClient.from("announcements").insert({
    id: annId, school_id: schoolId, title: "RLS Annonce Publiée", body: "Test", audience: "all", published_at: nowIso,
  });
  await serviceClient.from("announcements").insert({
    id: draftAnnId, school_id: schoolId, title: "RLS Annonce Brouillon", body: "Test", audience: "all", published_at: null,
  });
  const n1 = await parentC.from("announcements").select("id").in("id", [annId, draftAnnId]);
  const n1Ids = (n1.data ?? []).map((x: { id: string }) => x.id);
  ok("N1: le parent ne lit que les annonces publiées (pas les brouillons)", n1Ids.includes(annId) && !n1Ids.includes(draftAnnId), JSON.stringify(n1Ids));

  // ---- N2: parent cannot write announcements ----
  const n2 = await parentC.from("announcements").insert({
    school_id: schoolId, title: "Spam", body: "x", audience: "all",
  });
  ok("N2: un parent ne peut pas créer d'annonce", Boolean(n2.error), "l'insertion a réussi");

  // ---- N3: cross-school admin cannot write DEMO announcements ----
  const n3 = await otherAdminC.from("announcements").insert({
    school_id: schoolId, title: "Spam", body: "x", audience: "all",
  });
  ok("N3: un admin d'une autre école ne crée pas d'annonce DEMO", Boolean(n3.error), "l'insertion cross-école a réussi");

  // ---- N4: admin reads drafts (brouillons) ----
  const n4 = await adminC.from("announcements").select("id").eq("id", draftAnnId);
  ok("N4: l'admin lit les annonces en brouillon", !n4.error && (n4.data ?? []).length === 1, JSON.stringify(n4.data));

  // ---- Cleanup ----
  await serviceClient.from("grades").delete().in("assessment_id", [publishedAssessmentId, draftAssessmentId]);
  await serviceClient.from("assessments").delete().in("id", [publishedAssessmentId, draftAssessmentId]);
  await serviceClient.from("announcements").delete().in("id", [annId, draftAnnId]);
  if (periodRes?.id !== periodId) {
    await serviceClient.from("academic_periods").delete().eq("id", periodId);
  }

  console.log("\n------------------------------------");
  console.log(`Résultat : ${passed} passé(s), ${failed} échec(s)`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Erreur fatale:", e);
  process.exit(1);
});
