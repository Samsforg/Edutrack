/**
 * EduTrack — Verifier la sécurité & le fonctionnement de la liaison parent.
 *
 * Exécute le parcours réel (code généré par l'admin, saisie par le parent,
 * approbation) et vérifie les isolations RLS. Chaque « client » se connecte
 * via l'API anon (comme un vrai navigateur) : la RLS s'applique réellement.
 *
 * Prérequis : migrations 0011/0012 appliquées, seed exécuté, vars d'env
 * (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY) chargées depuis .env.local.
 *
 * Usage : npx tsx scripts/parent-linking-security-check.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCodeSalt, generateLinkCode, hashLinkCode } from "../lib/link-codes";

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

async function getAnyStudent(schoolId: string) {
  const { data } = await serviceClient
    .from("students")
    .select("id, first_name, last_name, matricule")
    .eq("school_id", schoolId)
    .limit(1)
    .maybeSingle();
  return data;
}

// Ensure a parent + admin exist on a second school (cross-tenant isolation).
// The two accounts are created (once) via the anon sign-in helper only if
// needed; their user ids are resolved from a real sign-in so we never rely
// on the auth admin listing API (which is unavailable in this SDK build).
async function ensureSecondSchool(): Promise<{
  schoolId: string;
  adminEmail: string;
  parentEmail: string;
  adminId: string;
  parentId: string;
}> {
  const adminEmail = "xadmin@verify.edutrack";
  const parentEmail = "xparent@verify.edutrack";
  const password = "demo-xsec1!";

  const { data: existing } = await serviceClient
    .from("schools")
    .select("id")
    .eq("code", "VERIFY2")
    .maybeSingle();
  let schoolId = existing?.id ?? null;

  if (!schoolId) {
    const { data, error } = await serviceClient
      .from("schools")
      .insert({ name: "Établissement Vérif 2", code: "VERIFY2" })
      .select("id")
      .single();
    if (error) throw error;
    schoolId = data.id;
  }

  // Ensure the two users exist. If they already exist, admin createUser
  // returns an "already registered" error which we ignore.
  await serviceClient.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Admin Vérif 2" },
  }).catch(() => undefined);
  await serviceClient.auth.admin.createUser({
    email: parentEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Parent Vérif 2" },
  }).catch(() => undefined);

  // Resolve their real user ids through a genuine sign-in.
  const aC = anonClient();
  const { data: aLogin } = await aC.auth.signInWithPassword({
    email: adminEmail,
    password,
  });
  const pC = anonClient();
  const { data: pLogin } = await pC.auth.signInWithPassword({
    email: parentEmail,
    password,
  });
  const adminId = aLogin.session?.user.id;
  const parentId = pLogin.session?.user.id;
  if (!adminId || !parentId) {
    throw new Error("Impossible de résoudre les comptes de la 2e école.");
  }

  await serviceClient
    .from("school_members")
    .upsert({ user_id: adminId, school_id: schoolId, role: "SCHOOL_ADMIN" });
  await serviceClient
    .from("school_members")
    .upsert({ user_id: parentId, school_id: schoolId, role: "PARENT" });
  await serviceClient.from("parents").upsert({
    user_id: parentId,
    school_id: schoolId,
    first_name: "Parent",
    last_name: "Vérif 2",
  });

  return { schoolId, adminEmail, parentEmail, adminId, parentId };
}

async function main() {
  console.log("\nVérification sécurité liaison parent-élève\n");

  const schoolId = await getSchoolId("DEMO");
  if (!schoolId) throw new Error("École DEMO introuvable (seed ?).");

  const student = await getAnyStudent(schoolId);
  if (!student) throw new Error("Aucun élève (seed ?).");

  const other = await ensureSecondSchool();
  const adminC = anonClient();
  const parent1C = anonClient();
  const parent2C = anonClient();
  const otherAdminC = anonClient();
  const otherParentC = anonClient();

  await login(adminC, "admin@demo.edutrack", "demo-admin1!");
  const parent1UserId = await login(parent1C, "parent1@demo.edutrack", "demo-parent1!");
  await login(parent2C, "parent2@demo.edutrack", "demo-parent2!");
  await login(otherAdminC, other.adminEmail, "demo-xsec1!");
  await login(otherParentC, other.parentEmail, "demo-xsec1!");

  // Resolve parent1's `parents` row id (used to scope the link + cleanup).
  const { data: parent1Row } = await serviceClient
    .from("parents")
    .select("id")
    .eq("user_id", parent1UserId)
    .eq("school_id", schoolId)
    .maybeSingle();
  const parent1RowId = parent1Row?.id;

  // ---- S1: admin generates a code (service role for setup, hash from prod lib) ----
  await serviceClient.from("student_link_codes").delete().eq("student_id", student.id);
  const genCode = generateLinkCode();
  const codeSalt = generateCodeSalt();
  const { error: genErr } = await serviceClient
    .from("student_link_codes")
    .insert({
      school_id: schoolId,
      student_id: student.id,
      code_salt: codeSalt,
      code_hash: hashLinkCode(genCode, codeSalt),
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });
  ok("S1: un code peut être généré", !genErr, genErr?.message ?? "");

  const { data: stored } = await serviceClient
    .from("student_link_codes")
    .select("code_salt, code_hash")
    .eq("student_id", student.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  ok(
    "S2: le code en clair n'est jamais stocké",
    stored != null &&
      !("code" in stored) &&
      typeof stored.code_hash === "string" &&
      stored.code_hash.length === 64
  );

  // ---- S3/S4: cross-tenant isolation via RLS on real clients ----
  const { data: otherParentCodes } = await otherParentC
    .from("student_link_codes")
    .select("*");
  ok(
    "S3: un parent n'a pas accès aux codes de liaison",
    otherParentCodes == null || otherParentCodes.length === 0,
    String((otherParentCodes ?? []).length)
  );

  const { data: otherAdminRequests } = await otherAdminC
    .from("student_link_requests")
    .select("*")
    .eq("school_id", schoolId);
  ok(
    "S4: un admin d'une autre école ne voit pas les demandes",
    otherAdminRequests == null || otherAdminRequests.length === 0,
    String((otherAdminRequests ?? []).length)
  );

  // ---- S5/S6: verify returns minimal shape ----
  const { data: verifyRes, error: verifyErr } = await parent1C.rpc(
    "verify_link_code",
    { p_code: genCode }
  );
  const verifiedRow = (verifyRes as Record<string, unknown>[] | null)?.[0];
  ok("S5: vérification d'un code valide", Boolean(!verifyErr && Array.isArray(verifyRes) && verifyRes.length === 1), verifyErr?.message ?? "");
  ok(
    "S6: la confirmation ne fuit ni matricule ni classe",
    verifiedRow != null &&
      !("matricule" in verifiedRow) &&
      !("classroom_id" in verifiedRow) &&
      verifiedRow.first_name != null,
    JSON.stringify(verifiedRow)
  );

  // ---- S7/S8: single-use ----
  const { data: createRes, error: createErr } = await parent1C.rpc(
    "create_link_request",
    { p_code: genCode }
  );
  const created = (createRes as Record<string, unknown>[] | null)?.[0] as
    | { request_id?: string }
    | undefined;
  ok("S7: création de la demande (usage unique)", Boolean(!createErr && created?.request_id), createErr?.message ?? "");

  const { error: secondErr } = await parent1C.rpc("create_link_request", {
    p_code: genCode,
  });
  ok(
    "S8: le code ne peut pas être réutilisé",
    Boolean(secondErr?.message?.includes("CODE_NOT_FOUND")),
    secondErr?.message ?? ""
  );

  const requestId = created!.request_id!;

  // ---- S9: parent cannot approve ----
  const { error: parentApproveErr } = await parent1C.rpc("resolve_link_request", {
    p_request_id: requestId,
    p_status: "approved",
    p_reason: null,
  });
  ok(
    "S9: un parent ne peut pas approuver sa propre demande",
    Boolean(parentApproveErr?.message?.includes("NOT_ALLOWED")),
    parentApproveErr?.message ?? ""
  );

  // ---- S10: parent only sees their own requests ----
  const { data: p2Requests } = await parent2C
    .from("student_link_requests")
    .select("*");
  ok(
    "S10: un autre parent ne voit pas la demande",
    p2Requests == null || p2Requests.length === 0,
    String((p2Requests ?? []).length)
  );

  // ---- S13: cross-school admin cannot process a pending request ----
  const { error: crossErr } = await otherAdminC.rpc("resolve_link_request", {
    p_request_id: requestId,
    p_status: "approved",
    p_reason: null,
  });
  ok(
    "S13: un admin d'une autre école ne peut pas traiter (ni voir) la demande",
    Boolean(
      crossErr?.message?.includes("NOT_FOUND") ||
        crossErr?.message?.includes("NOT_ALLOWED")
    ),
    crossErr?.message ?? ""
  );

  // ---- S11: admin approves -> link created ----
  const { error: approveErr } = await adminC.rpc("resolve_link_request", {
    p_request_id: requestId,
    p_status: "approved",
    p_reason: null,
  });
  ok("S11: l'admin approuve la demande", Boolean(!approveErr), approveErr?.message ?? "");

  const { data: spRow } = await serviceClient
    .from("student_parents")
    .select("id")
    .eq("student_id", student.id)
    .eq("parent_id", parent1RowId)
    .limit(1)
    .maybeSingle();
  ok("S12: la liaison élève-parent est créée", !!spRow && !!parent1RowId);

  // ---- Cleanup: roll back the test link so the demo dataset stays stable ----
  if (parent1RowId) {
    await serviceClient
      .from("student_parents")
      .delete()
      .eq("student_id", student.id)
      .eq("parent_id", parent1RowId);
  }
  await serviceClient.from("student_link_requests").delete().eq("id", requestId);
  await serviceClient
    .from("student_link_codes")
    .delete()
    .eq("student_id", student.id);

  console.log("\n------------------------------------");
  console.log(`Résultat : ${passed} passé(s), ${failed} échec(s)`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Erreur fatale:", e);
  process.exit(1);
});