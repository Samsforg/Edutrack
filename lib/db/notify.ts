import { createClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/types/enums";

/**
 * Returns the distinct parent user ids for a set of students.
 * Only parents who have a linked account are notified.
 */
export async function getParentUserIdsForStudents(
  studentIds: string[]
): Promise<string[]> {
  if (studentIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_parents")
    .select("parents(user_id)")
    .in("student_id", studentIds);

  if (error || !data) return [];

  const userIds = new Set<string>();
  for (const row of data as unknown as {
    parents: { user_id: string | null } | null;
  }[]) {
    if (row.parents?.user_id) userIds.add(row.parents.user_id);
  }
  return Array.from(userIds);
}

/**
 * Returns parent user ids for every parent of a school with an account.
 */
export async function getParentUserIdsForSchool(
  schoolId: string
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parents")
    .select("user_id")
    .eq("school_id", schoolId)
    .not("user_id", "is", null);

  if (error || !data) return [];
  return (data as unknown as { user_id: string }[])
    .map((p) => p.user_id)
    .filter(Boolean);
}

/**
 * Returns parent user ids for parents of students in a class.
 */
export async function getParentUserIdsForClass(
  classroomId: string
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("id")
    .eq("classroom_id", classroomId);

  if (error || !data) return [];
  return getParentUserIdsForStudents(data.map((s) => s.id));
}

/**
 * Inserts one notification per user. All-or-nothing friendly (batched).
 */
export async function insertNotifications(
  userIds: string[],
  input: {
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
  }
): Promise<{ error?: string }> {
  if (userIds.length === 0) return {};
  const supabase = await createClient();
  const rows = userIds.map((uid) => ({
    user_id: uid,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  }));
  const { error } = await supabase.from("notifications").insert(rows);
  return error ? { error: error.message } : {};
}