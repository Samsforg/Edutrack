"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { writeBlockMessage } from "@/lib/billing/access";
import {
  getParentUserIdsForStudents,
} from "@/lib/db/notify";

// ── Schemas ────────────────────────────────────────────────────

const assessmentSchema = z.object({
  id: z.string().uuid().optional(),
  schoolId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  teacherId: z.string().uuid(),
  academicPeriodId: z.string().uuid(),
  title: z.string().min(1, "Titre requis"),
  description: z.string().optional(),
  maxScore: z.coerce.number().positive("Note maximale > 0"),
  coefficient: z.coerce.number().positive("Coefficient > 0").default(1),
  assessmentDate: z.string().min(1, "Date requise"),
});

const batchGradesSchema = z.object({
  assessmentId: z.string().uuid(),
  grades: z.array(
    z.object({
      studentId: z.string().uuid(),
      score: z.coerce.number().min(0, "Note >= 0"),
      comment: z.string().max(255).optional(),
    })
  ).min(1, "Au moins une note requise"),
});

// ── Types ──────────────────────────────────────────────────────

export type ActionResult = { error?: string; ok?: boolean; id?: string };

// ── Helpers ────────────────────────────────────────────────────

async function resolveTeacher(userId: string, schoolId: string) {
  const supabase = await createClient();
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .maybeSingle();
  return teacher?.id ?? null;
}

// ── Assessments ────────────────────────────────────────────────

export async function createAssessment(
  input: z.infer<typeof assessmentSchema>
): Promise<ActionResult> {
  const parsed = assessmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;

  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };

  const membership = session.memberships.find((m) => m.school_id === d.schoolId);
  if (!membership) return { error: "Accès refusé" };

  const blocked = await writeBlockMessage(d.schoolId);
  if (blocked) return { error: blocked };

  const teacherId = await resolveTeacher(session.user.id, d.schoolId);
  if (!teacherId && membership.role === "TEACHER") {
    return { error: "Enseignant non trouvé" };
  }

  // Teachers must use the teacherId of their own teacher row; admins specify one.
  const effectiveTeacherId = membership.role === "TEACHER" ? teacherId : d.teacherId;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .insert({
      school_id: d.schoolId,
      class_id: d.classId,
      subject_id: d.subjectId,
      teacher_id: effectiveTeacherId!,
      academic_period_id: d.academicPeriodId,
      title: d.title,
      description: d.description || null,
      max_score: d.maxScore,
      coefficient: d.coefficient,
      assessment_date: d.assessmentDate,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/app/teacher/grades");
  return { ok: true, id: data.id };
}

export async function updateAssessment(
  input: z.infer<typeof assessmentSchema>
): Promise<ActionResult> {
  const parsed = assessmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;
  if (!d.id) return { error: "ID requis pour la mise à jour" };

  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };

  const membership = session.memberships.find((m) => m.school_id === d.schoolId);
  if (!membership || !["SCHOOL_ADMIN", "TEACHER"].includes(membership.role)) {
    return { error: "Accès refusé" };
  }

  const blocked = await writeBlockMessage(d.schoolId);
  if (blocked) return { error: blocked };

  const supabase = await createClient();
  const { error } = await supabase
    .from("assessments")
    .update({
      title: d.title,
      description: d.description || null,
      max_score: d.maxScore,
      coefficient: d.coefficient,
      assessment_date: d.assessmentDate,
    })
    .eq("id", d.id)
    .eq("school_id", d.schoolId);

  if (error) return { error: error.message };

  revalidatePath("/app/teacher/grades");
  return { ok: true };
}

export async function publishAssessment(
  assessmentId: string,
  publish: boolean,
): Promise<ActionResult> {
  if (!assessmentId) return { error: "ID requis" };

  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };

  const supabase = await createClient();

  const { data: assessment, error: fetchErr } = await supabase
    .from("assessments")
    .select("id, school_id, class_id, subject_id, published")
    .eq("id", assessmentId)
    .maybeSingle();

  if (fetchErr || !assessment) return { error: "Évaluation introuvable" };

  const membership = session.memberships.find((m) => m.school_id === assessment.school_id);
  if (!membership || !["SCHOOL_ADMIN", "TEACHER"].includes(membership.role)) {
    return { error: "Accès refusé" };
  }

  const blocked = await writeBlockMessage(assessment.school_id);
  if (blocked) return { error: blocked };

  const { error } = await supabase
    .from("assessments")
    .update({ published: publish })
    .eq("id", assessmentId);

  if (error) return { error: error.message };

  revalidatePath("/app/teacher/grades");
  return { ok: true };
}

// ── Grades (batch save) ────────────────────────────────────────

export async function saveClassGrades(
  input: z.infer<typeof batchGradesSchema>
): Promise<ActionResult> {
  const parsed = batchGradesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;

  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };

  const supabase = await createClient();

  // Resolve assessment + school + teacher
  const { data: assessment, error: aErr } = await supabase
    .from("assessments")
    .select("id, school_id, class_id, subject_id, teacher_id, max_score, coefficient, title")
    .eq("id", d.assessmentId)
    .maybeSingle();

  if (aErr || !assessment) return { error: "Évaluation introuvable" };

  const membership = session.memberships.find((m) => m.school_id === assessment.school_id);
  if (!membership || !["SCHOOL_ADMIN", "TEACHER"].includes(membership.role)) {
    return { error: "Accès refusé" };
  }

  const blocked = await writeBlockMessage(assessment.school_id);
  if (blocked) return { error: blocked };

  // Build upsert rows
  const rows = d.grades.map((g) => ({
    school_id: assessment.school_id,
    student_id: g.studentId,
    subject_id: assessment.subject_id,
    classroom_id: assessment.class_id,
    teacher_id: assessment.teacher_id,
    assessment_id: d.assessmentId,
    title: assessment.title,
    score: g.score,
    max_score: assessment.max_score,
    coefficient: assessment.coefficient,
    grade_date: new Date().toISOString().slice(0, 10),
    comment: g.comment || null,
    graded_by: session.user.id,
  }));

  const { error } = await supabase
    .from("grades")
    .upsert(rows, { onConflict: "assessment_id,student_id" });

  if (error) return { error: error.message };

  revalidatePath("/app/teacher/grades");
  revalidatePath("/app/parent");
  return { ok: true };
}

/**
 * Publish all grades for an assessment (sets published_at).
 * Creates notifications for parents.
 */
export async function publishGrades(
  assessmentId: string,
): Promise<ActionResult> {
  if (!assessmentId) return { error: "ID requis" };

  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };

  const supabase = await createClient();

  // Fetch assessment
  const { data: assessment, error: aErr } = await supabase
    .from("assessments")
    .select("id, school_id, class_id, subject_id, title, published")
    .eq("id", assessmentId)
    .maybeSingle();

  if (aErr || !assessment) return { error: "Évaluation introuvable" };

  const membership = session.memberships.find((m) => m.school_id === assessment.school_id);
  if (!membership || !["SCHOOL_ADMIN", "TEACHER"].includes(membership.role)) {
    return { error: "Accès refusé" };
  }

  const blocked = await writeBlockMessage(assessment.school_id);
  if (blocked) return { error: blocked };

  // Publish assessment + all its grades (batch)
  const now = new Date().toISOString();
  const { error: pubErr } = await supabase
    .from("assessments")
    .update({ published: true })
    .eq("id", assessmentId);

  if (pubErr) return { error: pubErr.message };

  // Set published_at on all grades for this assessment (batch upsert-style update)
  const { data: gradesToUpdate } = await supabase
    .from("grades")
    .select("id, student_id")
    .eq("assessment_id", assessmentId)
    .is("published_at", null);

  if (gradesToUpdate && gradesToUpdate.length > 0) {
    const ids = (gradesToUpdate as { id: string; student_id: string }[]).map((g) => g.id);
    const { error: gradeErr } = await supabase
      .from("grades")
      .update({ published_at: now })
      .in("id", ids);

    if (gradeErr) return { error: gradeErr.message };

    // Create notifications per student (batch, no duplicate per type+entity)
    const studentIds = (gradesToUpdate as { id: string; student_id: string }[]).map((g) => g.student_id);
    const parentUserIds = await getParentUserIdsForStudents(studentIds);

    // Fetch subject name
    const { data: subject } = await supabase
      .from("subjects")
      .select("name")
      .eq("id", assessment.subject_id)
      .maybeSingle();

    const subjectName = (subject as { name: string } | null)?.name ?? "Matière";

    // Insert notifications (idempotent via upsert or simple insert, one per parent)
    for (const uid of parentUserIds) {
      // Check for existing notification for this assessment+student+user to avoid duplicates
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", uid)
        .eq("type", "grade")
        .eq("link", `/app/parent`)
        .ilike("body", `%${assessment.title}%`)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("notifications").insert({
          user_id: uid,
          type: "grade",
          title: "Nouvelle note",
          body: `Une nouvelle note de ${subjectName} (${assessment.title}) a été publiée.`,
          link: "/app/parent",
        });
      }
    }
  }

  revalidatePath("/app/teacher/grades");
  revalidatePath("/app/parent");
  return { ok: true };
}

// ── Periods ────────────────────────────────────────────────────

export async function createPeriod(input: {
  schoolId: string;
  academicYearId: string;
  name: string;
  type?: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };

  const membership = session.memberships.find((m) => m.school_id === input.schoolId);
  if (!membership || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(membership.role)) {
    return { error: "Accès refusé" };
  }

  const supabase = await createClient();

  // If setting as current, unset other current periods for this year
  if (input.isCurrent) {
    await supabase
      .from("academic_periods")
      .update({ is_current: false })
      .eq("school_id", input.schoolId)
      .eq("academic_year_id", input.academicYearId)
      .eq("is_current", true);
  }

  const { data, error } = await supabase
    .from("academic_periods")
    .insert({
      school_id: input.schoolId,
      academic_year_id: input.academicYearId,
      name: input.name,
      type: input.type ?? "term",
      start_date: input.startDate,
      end_date: input.endDate,
      is_current: input.isCurrent ?? false,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/app/admin/academic-years");
  return { ok: true, id: data.id };
}
