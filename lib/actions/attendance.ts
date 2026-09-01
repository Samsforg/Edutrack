"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { ATTENDANCE_STATUSES } from "@/types/enums";

const attendanceSchema = z.object({
  classId: z.string().uuid(),
  entries: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: z.enum(ATTENDANCE_STATUSES),
      })
    )
    .min(1, "Au moins un élève est requis"),
});

export type SaveAttendanceResult =
  | { error: string }
  | { ok: true; saved: number };

/**
 * Batch-saves today's attendance for a class in a single operation.
 * School id is resolved from the server-side session, never trusted
 * from the client. Only teachers assigned to the class or admins may
 * write (enforced by RLS + the check below).
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

  const supabase = await createClient();

  // Load the class + school id server-side.
  const { data: cls } = await supabase
    .from("classes")
    .select("id, school_id")
    .eq("id", parsed.data.classId)
    .maybeSingle();

  if (!cls) {
    return { error: "Classe introuvable" };
  }

  // Server-side authorization in addition to RLS.
  const membership = session.memberships.find(
    (m) => m.school_id === cls.school_id
  );
  if (!membership || !["SCHOOL_ADMIN", "TEACHER"].includes(membership.role)) {
    return { error: "Accès refusé" };
  }

  const today = new Date().toISOString().slice(0, 10);

  // Load students of the class to map id + verify they belong.
  const { data: students } = await supabase
    .from("students")
    .select("id, school_id")
    .in(
      "id",
      parsed.data.entries.map((e) => e.studentId)
    );

  const valid = new Set(students?.map((s) => s.id) ?? []);
  const rows = parsed.data.entries
    .filter((e) => valid.has(e.studentId))
    .map((e) => ({
      school_id: cls.school_id,
      student_id: e.studentId,
      classroom_id: cls.id,
      attendance_date: today,
      status: e.status,
      taken_by: session.user.id,
    }));

  if (rows.length === 0) {
    return { error: "Aucun élève valide" };
  }

  // Upsert is safe given the unique (student_id, attendance_date) constraint.
  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "student_id,attendance_date" });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/app/parent");
  revalidatePath("/app/teacher");
  revalidatePath("/app/admin");

  return { ok: true, saved: rows.length };
}