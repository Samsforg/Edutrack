"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { writeBlockMessage } from "@/lib/billing/access";
import { ATTENDANCE_STATUSES } from "@/types/enums";
import type { AttendanceStatus } from "@/types/enums";
import { getParentUserIdsForStudents } from "@/lib/db/notify";

/**
 * One status per student. `date` defaults to today (server-side).
 * `checkIn`, `checkOut`, `note` are optional per student (keyed by student id).
 */
const attendanceSchema = z.object({
  classId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
    .optional(),
  entries: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: z.enum(ATTENDANCE_STATUSES),
      })
    )
    .min(1, "Au moins un élève est requis"),
  checkIns: z.record(z.string().uuid(), z.string()).optional(),
  checkOuts: z.record(z.string().uuid(), z.string()).optional(),
  notes: z
    .record(
      z.string().uuid(),
      z.string().max(255, "Note trop longue (255 caractères max)")
    )
    .optional(),
});

export type SaveAttendanceResult =
  | { error: string }
  | { ok: true; saved: number };

/**
 * Batch-saves attendance for a class on a date in a single operation.
 * - The school id is resolved from the server-side session, never the client.
 * - Only teachers assigned to the class (via class_subjects) or school admins
 *   may write (enforced by RLS `attendance_write` + the checks below).
 * - `ON CONFLICT(student_id, attendance_date)` makes the operation idempotent:
 *   a second save updates the existing row instead of creating a duplicate.
 * - Per-student notifications (Absence / Retard / Absence excusée) are created
 *   for the linked parents when the status differs from what we care about.
 */
export async function saveAttendance(
  input: z.infer<typeof attendanceSchema>
): Promise<SaveAttendanceResult> {
  const parsed = attendanceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const session = await getSession();
  if (!session?.user) {
    return { error: "Non authentifié" };
  }

  const d = parsed.data;
  const date = d.date ?? new Date().toISOString().slice(0, 10);

  const supabase = await createClient();

  // Load the class + school id server-side.
  const { data: cls, error: clsErr } = await supabase
    .from("classes")
    .select("id, school_id")
    .eq("id", d.classId)
    .maybeSingle();

  if (clsErr || !cls) {
    return { error: "Classe introuvable" };
  }

  // Server-side authorization in addition to RLS.
  const membership = session.memberships.find(
    (m) => m.school_id === cls.school_id
  );
  if (!membership || !["SCHOOL_ADMIN", "TEACHER"].includes(membership.role)) {
    return { error: "Accès refusé" };
  }
  // A teacher can only take attendance for classes they teach.
  if (membership.role === "TEACHER") {
    const teacherIds =
      session.memberships
        .filter(
          (m) =>
            m.school_id === cls.school_id && m.role === "TEACHER"
        )
        .length > 0
        ? await getTeacherIdsForUser(supabase, session.user.id, cls.school_id)
        : [];
    if (teacherIds.length === 0) {
      return { error: "Accès refusé : classe non affectée" };
    }
    const { count } = await supabase
      .from("class_subjects")
      .select("*", { count: "exact", head: true })
      .eq("class_id", d.classId)
      .in("teacher_id", teacherIds);
    if ((count ?? 0) === 0) {
      return { error: "Accès refusé : classe non affectée" };
    }
  }

  // Garde-fou abonnement : l'école expirée est en lecture seule.
  const blocked = await writeBlockMessage(cls.school_id);
  if (blocked) return { error: blocked };

  // Load students of the class to map + verify they belong and get names.
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("classroom_id", d.classId);

  const byId = new Map((students ?? []).map((s) => [s.id, s]));
  const rows = d.entries
    .filter((e) => byId.has(e.studentId))
    .map((e) => ({
      school_id: cls.school_id,
      student_id: e.studentId,
      classroom_id: cls.id,
      attendance_date: date,
      status: e.status,
      taken_by: session.user.id,
      updated_by: session.user.id,
      check_in: d.checkIns?.[e.studentId] ?? null,
      check_out: d.checkOuts?.[e.studentId] ?? null,
      note: d.notes?.[e.studentId] ?? null,
    }));

  if (rows.length === 0) {
    return { error: "Aucun élève valide" };
  }

  // Atomic upsert: all rows succeed or none is persisted.
  const { error: saveErr } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "student_id,attendance_date" });

  if (saveErr) {
    return { error: saveErr.message };
  }

  // Per-student notifications to linked parents for non-present statuses.
  const flagged = rows.filter((r) => r.status !== "present");
  if (flagged.length > 0) {
    const parentIds = await getParentUserIdsForStudents(
      flagged.map((r) => r.student_id)
    );
    const statusToTitle: Record<AttendanceStatus, string> = {
      absent: "Absence",
      late: "Retard",
      excused: "Absence excusée",
      present: "",
    };
    const notifRows: {
      user_id: string;
      type: "attendance";
      title: string;
      body: string | null;
      link: string;
    }[] = [];
    for (const pid of parentIds) {
      for (const r of flagged) {
        const student = byId.get(r.student_id);
        const fullName = student
          ? `${student.first_name} ${student.last_name}`
          : "votre enfant";
        const title = statusToTitle[r.status];
        notifRows.push({
          user_id: pid,
          type: "attendance",
          title,
          body: `Votre enfant ${fullName} est marqué ${
            r.status === "late"
              ? "en retard"
              : r.status === "excused"
                ? "excusé"
                : "absent"
          } aujourd'hui.`,
          link: "/app/parent",
        });
      }
    }
    if (notifRows.length > 0) {
      await supabase.from("notifications").insert(notifRows);
    }
  }

  revalidatePath("/app/parent");
  revalidatePath("/app/teacher");
  revalidatePath("/app/admin");
  revalidatePath("/app/parent/children");

  return { ok: true, saved: rows.length };
}

/**
 * Returns the teacher row ids for a user (used to scope class_subjects checks).
 */
async function getTeacherIdsForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  schoolId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", userId)
    .eq("school_id", schoolId);
  return (data ?? []).map((t) => t.id);
}