/**
 * EduTrack — Seed de développement.
 *
 * Crée l'« Établissement Démo EduTrack » avec des classes, élèves,
 * enseignants, parents, présences, notes et annonces.
 *
 * Prérequis : migrations appliquées et variables d'environnement définies
 * (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 *
 * Usage : npm run db:seed
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(): { url: string; serviceKey: string } {
  const envFile = path.resolve(__dirname, "../.env.local");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
      if (m) process.env[m[1]] ??= m[2].trim();
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour le seed."
    );
  }
  return { url, serviceKey };
}

const { url, serviceKey } = loadEnv();
const supabase: SupabaseClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = "demo-admin1!";

async function upsertUser(email: string, password: string, fullName: string) {
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users.find((u) => u.email === email);
  if (found) return found.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  console.log("🌱 Seed EduTrack …");

  // 1. Établissement
  let schoolId: string;
  const { data: existingSchool } = await supabase
    .from("schools")
    .select("id")
    .eq("code", "DEMO")
    .maybeSingle();
  if (existingSchool) {
    schoolId = existingSchool.id;
    console.log("  Établissement existant, skip.");
  } else {
    const { data, error } = await supabase
      .from("schools")
      .insert({ name: "Établissement Démo EduTrack", code: "DEMO" })
      .select("id")
      .single();
    if (error) throw error;
    schoolId = data.id;
    console.log("  Établissement créé.");
  }

  // 2. Comptes
  const adminId = await upsertUser(
    "admin@demo.edutrack",
    DEMO_PASSWORD,
    "Admin Démo"
  );
  const teacher1Id = await upsertUser(
    "teacher1@demo.edutrack",
    "demo-teach1!",
    "Moussa Keita"
  );
  const teacher2Id = await upsertUser(
    "teacher2@demo.edutrack",
    "demo-teach2!",
    "Awa Diop"
  );
  const parent1Id = await upsertUser(
    "parent1@demo.edutrack",
    "demo-parent1!",
    "Fatou Ndiaye"
  );
  const parent2Id = await upsertUser(
    "parent2@demo.edutrack",
    "demo-parent2!",
    "Ibrahima Sow"
  );
  const parent3Id = await upsertUser(
    "parent3@demo.edutrack",
    "demo-parent3!",
    "Khadija Fall"
  );
  const superAdminId = await upsertUser(
    "superadmin@demo.edutrack",
    "demo-superadmin1!",
    "Directeur Plateforme"
  );

  // 3. Memberships
  const memberships: { user_id: string; school_id: string; role: string }[] = [
    { user_id: adminId, school_id: schoolId, role: "SCHOOL_ADMIN" },
    { user_id: teacher1Id, school_id: schoolId, role: "TEACHER" },
    { user_id: teacher2Id, school_id: schoolId, role: "TEACHER" },
    { user_id: parent1Id, school_id: schoolId, role: "PARENT" },
    { user_id: parent2Id, school_id: schoolId, role: "PARENT" },
    { user_id: parent3Id, school_id: schoolId, role: "PARENT" },
    { user_id: superAdminId, school_id: schoolId, role: "SUPER_ADMIN" },
  ];
  for (const m of memberships) {
    await supabase.from("school_members").upsert(m, {
      onConflict: "user_id,school_id",
    });
  }
  console.log("  Membres créés.");

  // 4. Année scolaire active
  const year = new Date().getFullYear();
  let akId: string;
  const { data: existingYear } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("name", `${year}-${year + 1}`)
    .maybeSingle();
  if (existingYear) {
    akId = existingYear.id;
  } else {
    const { data, error } = await supabase
      .from("academic_years")
      .insert({
        school_id: schoolId,
        name: `${year}-${year + 1}`,
        start_date: `${year}-09-01`,
        end_date: `${year + 1}-07-31`,
        is_current: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    akId = data.id;
  }

  // 5. Classes
  const classNames = ["6ème A", "5ème A", "3ème A"];
  const classIdMap: Record<string, string> = {};
  for (const name of classNames) {
    const { data } = await supabase
      .from("classes")
      .select("id")
      .eq("school_id", schoolId)
      .eq("name", name)
      .maybeSingle();
    if (data) {
      classIdMap[name] = data.id;
      continue;
    }
    const { data: cls, error } = await supabase
      .from("classes")
      .insert({
        school_id: schoolId,
        academic_year_id: akId,
        name,
      })
      .select("id")
      .single();
    if (error) throw error;
    classIdMap[name] = cls.id;
  }
  console.log("  Classes créées:", Object.values(classIdMap).length);

  // 6. Enseignants + matières + class_subjects
  const teacher1Data = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", teacher1Id)
    .maybeSingle();
  const t1Id =
    teacher1Data.data?.id ??
    (
      await supabase
        .from("teachers")
        .insert({
          school_id: schoolId,
          user_id: teacher1Id,
          employee_number: "EMP-001",
          first_name: "Moussa",
          last_name: "Keita",
        })
        .select("id")
        .single()
    ).data!.id;

  const teacher2Data = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", teacher2Id)
    .maybeSingle();
  const t2Id =
    teacher2Data.data?.id ??
    (
      await supabase
        .from("teachers")
        .insert({
          school_id: schoolId,
          user_id: teacher2Id,
          employee_number: "EMP-002",
          first_name: "Awa",
          last_name: "Diop",
        })
        .select("id")
        .single()
    ).data!.id;

  async function getSubject(name: string, code: string) {
    const { data } = await supabase
      .from("subjects")
      .select("id")
      .eq("school_id", schoolId)
      .eq("name", name)
      .maybeSingle();
    if (data) return data.id;
    return (
      await supabase
        .from("subjects")
        .insert({ school_id: schoolId, name, code })
        .select("id")
        .single()
    ).data!.id;
  }

  const maths = await getSubject("Mathématiques", "MAT");
  const french = await getSubject("Français", "FRA");
  const english = await getSubject("Anglais", "ANG");

  async function assignSubject(classId: string, subjectId: string, teacherId: string) {
    await supabase
      .from("class_subjects")
      .upsert(
        { class_id: classId, subject_id: subjectId, teacher_id: teacherId },
        { onConflict: "class_id,subject_id" }
      );
  }

  for (const cls of Object.values(classIdMap)) {
    await assignSubject(cls, maths, t1Id);
    await assignSubject(cls, french, t1Id);
    await assignSubject(cls, english, t2Id);
  }
  console.log("  Matières assignées.");

  // 7. Élèves (10-20)
  const firstNamePool = ["Amadou", "Aïcha", "Mariam", "Omar", "Fatoumata", "Yaya", "Binta", "Mamadou", "Seydou", "Nafissatou", "Diouf", "Rokhaya", "Cheikh", "Adama", "Kadiatou"];
  const lastNamePool = ["Cissé", "Ba", "Sy", "Diallo", "Traoré", "Camara", "Kone", "Sall", "Faye", "Ndiaye"];
  const studentIdByClass: Record<string, string[]> = {};
  let created = 0;

  for (const [name, classId] of Object.entries(classIdMap)) {
    const target = name === "3ème A" ? 12 : 14;
    for (let i = 0; i < target; i++) {
      const firstName = firstNamePool[Math.floor(Math.random() * firstNamePool.length)];
      const lastName = lastNamePool[Math.floor(Math.random() * lastNamePool.length)];
      const matricule = `${name.split(" ")[0]}-${(i + 1).toString().padStart(3, "0")}`;
      const { data } = await supabase
        .from("students")
        .select("id")
        .eq("school_id", schoolId)
        .eq("matricule", matricule)
        .maybeSingle();
      if (data) {
        (studentIdByClass[name] ??= []).push(data.id);
        continue;
      }
      const { data: student, error } = await supabase
        .from("students")
        .insert({
          school_id: schoolId,
          classroom_id: classId,
          academic_year_id: akId,
          matricule,
          first_name: firstName,
          last_name: lastName,
        })
        .select("id")
        .single();
      if (error) throw error;
      (studentIdByClass[name] ??= []).push(student.id);
      created++;
    }
  }
  console.log("  Élèves créés:", created);

  // 8. Parents + liaisons
  const parentRows: { user_id: string; first_name: string; last_name: string }[] = [
    { user_id: parent1Id, first_name: "Fatou", last_name: "Ndiaye" },
    { user_id: parent2Id, first_name: "Ibrahima", last_name: "Sow" },
    { user_id: parent3Id, first_name: "Khadija", last_name: "Fall" },
  ];
  const parentIdMap = new Map<string, string>();
  for (const p of parentRows) {
    const { data } = await supabase
      .from("parents")
      .select("id")
      .eq("user_id", p.user_id)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (data) {
      parentIdMap.set(p.user_id, data.id);
      continue;
    }
    const { data: row, error } = await supabase
      .from("parents")
      .insert({ school_id: schoolId, user_id: p.user_id, first_name: p.first_name, last_name: p.last_name })
      .select("id")
      .single();
    if (error) throw error;
    parentIdMap.set(p.user_id, row.id);
  }

  // Liens déterministes : parent1 -> 1er élève de chaque classe ;
  // parent2 -> tous les élèves de 3ème A ; parent3 -> 3 élèves de 5ème A.
  // On efface d'abord les liaisons existantes de ces parents pour rester
  // déterministe (ré-exécutions répétées sans doublons).
  const parentRowIds = [...parentIdMap.values()];
  if (parentRowIds.length) {
    await supabase.from("student_parents").delete().in("parent_id", parentRowIds);
  }
  const parentUserIds = [...parentIdMap.keys()];
  const allStudents: string[] = Object.values(studentIdByClass).flat();
  const links = new Set<string>();
  if (allStudents.length > 0) {
    const p1 = parentIdMap.get(parentUserIds[0])!;
    links.add(`${p1}:${allStudents[0]}`);
  }
  if (studentIdByClass["3ème A"]?.length) {
    const p2 = parentIdMap.get(parentUserIds[1])!;
    studentIdByClass["3ème A"].forEach((sid) => links.add(`${p2}:${sid}`));
  }
  if (studentIdByClass["5ème A"]?.length) {
    const p3 = parentIdMap.get(parentUserIds[2])!;
    studentIdByClass["5ème A"].slice(0, 3).forEach((sid) => links.add(`${p3}:${sid}`));
  }
  for (const link of links) {
    const [pid, sid] = link.split(":");
    const { error: linkErr } = await supabase.from("student_parents").upsert(
      { student_id: sid, parent_id: pid },
      { onConflict: "student_id,parent_id" }
    );
    if (linkErr) throw new Error(`Liaison parent-élève impossible (${pid}:${sid}): ${linkErr.message}`);
  }
  console.log("  Liaisons parents créées:", links.size);

  // 9. Présences récentes
  const today = new Date();
  for (let d = 1; d <= 5; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const iso = date.toISOString().slice(0, 10);
    const classNamesArr = Object.keys(classIdMap);
    for (const cn of classNamesArr) {
      const students = studentIdByClass[cn] ?? [];
      for (const sid of students) {
        const roll = Math.random();
        const status = roll < 0.85 ? "present" : roll < 0.92 ? "absent" : roll < 0.97 ? "late" : "excused";
        await supabase.from("attendance").upsert(
          {
            school_id: schoolId,
            student_id: sid,
            classroom_id: classIdMap[cn],
            attendance_date: iso,
            status,
            taken_by: adminId,
          },
          { onConflict: "student_id,attendance_date" }
        );
        if (status !== "present") {
          await supabase.from("notifications").insert({
            user_id: parent1Id,
            type: "attendance",
            title: "Absence signalée",
            body: `${firstNamePool[0]} ${lastNamePool[0]} — ${status}`,
          });
        }
      }
    }
  }
  console.log("  Présences générées.");

  // 10. Notes
  const gradeTitles = ["Contrôle n°1", "Contrôle n°2", "Devoir"];
  let gradesCreated = 0;
  for (const cn of Object.keys(classIdMap)) {
    const students = studentIdByClass[cn] ?? [];
    for (const sid of students.slice(0, 6)) {
      for (const [subjectId, teacherId] of [[maths, t1Id], [french, t1Id]] as const) {
        const score = Math.round((Math.random() * 15 + 5) * 100) / 100;
        await supabase.from("grades").insert({
          school_id: schoolId,
          student_id: sid,
          subject_id: subjectId,
          classroom_id: classIdMap[cn],
          teacher_id: teacherId,
          title: gradeTitles[Math.floor(Math.random() * gradeTitles.length)],
          score,
          max_score: 20,
          coefficient: 1,
          grade_date: new Date(today.getTime() - 3 * 864e5).toISOString().slice(0, 10),
        });
        gradesCreated++;
      }
    }
  }
  console.log("  Notes créées:", gradesCreated);

  // 11. Annonces
  const { error: annError } = await supabase.from("announcements").insert([
    {
      school_id: schoolId,
      author_id: adminId,
      audience: "all",
      title: "Rentrée scolaire",
      body: "La rentrée aura lieu le 5 septembre à 8h00.",
      important: true,
    },
    {
      school_id: schoolId,
      author_id: adminId,
      audience: "all",
      title: "Réunion parents",
      body: "Réunion des parents le 15 octobre à 17h00.",
      important: false,
    },
  ]);
  if (annError) {
    console.warn("  Annonces non créées (éventuellement en doublon).");
  }

  console.log("✅ Seed terminé.");
  console.log("Table de comptes de test documentée dans le README.");
}

void main().catch((err) => {
  console.error("❌ Seed échoué:", err);
  process.exit(1);
});