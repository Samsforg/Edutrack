import { createClient } from "@/lib/supabase/server";
import type { ParentLinkRequestListItem } from "@/types/student-link";

/**
 * Returns the link requests belonging to the calling parent.
 * RLS (`link_requests_select`) guarantees a parent only sees their own,
 * so we never filter by parent_id in the query.
 */
export async function getParentLinkRequests(): Promise<ParentLinkRequestListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_link_requests")
    .select(
      `id, status, created_at, expires_at, reason,
       students(first_name, last_name),
       schools(name)`
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  const now = Date.now();

  return (data as unknown as {
    id: string;
    status: ParentLinkRequestListItem["status"];
    created_at: string;
    expires_at: string;
    reason: string | null;
    students: { first_name: string; last_name: string } | null;
    schools: { name: string } | null;
  }[]).map((r) => ({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    expires_at: r.expires_at,
    reason: r.reason,
    student_first_name: r.students?.first_name ?? null,
    student_last_name: r.students?.last_name ?? null,
    school_name: r.schools?.name ?? null,
    is_expired: r.status === "pending" && new Date(r.expires_at).getTime() < now,
  }));
}