import { createClient } from "@/lib/supabase/server";

export type PendingLinkRequest = {
  id: string;
  code: string;
  status: "pending" | "approved" | "rejected" | "expired";
  created_at: string;
  parent_name: string | null;
  student_name: string | null;
  matricule: string | null;
};

/**
 * Lists link requests for a school (admin view).
 * RLS only allows admins (or the owning parent) to see them.
 */
export async function listLinkRequests(
  schoolId: string,
  onlyPending = true
): Promise<PendingLinkRequest[]> {
  const supabase = await createClient();

  let query = supabase
    .from("student_link_requests")
    .select(
      "id, code, status, created_at, parents(first_name, last_name, user_id), students(first_name, last_name, matricule)"
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (onlyPending) {
    query = query.eq("status", "pending");
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return (data as unknown as {
    id: string;
    code: string;
    status: "pending" | "approved" | "rejected" | "expired";
    created_at: string;
    parents: { first_name: string; last_name: string; user_id: string | null } | null;
    students: { first_name: string; last_name: string; matricule: string } | null;
  }[]).map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    created_at: r.created_at,
    parent_name: r.parents
      ? `${r.parents.first_name} ${r.parents.last_name} (${r.parents.user_id ? "compte lié" : "sans compte"})`
      : "—",
    student_name: r.students
      ? `${r.students.first_name} ${r.students.last_name}`
      : "—",
    matricule: r.students?.matricule ?? null,
  }));
}