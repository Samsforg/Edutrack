import { createClient } from "@/lib/supabase/server";
import type { LinkRequestListItem } from "@/types/student-link";

/**
 * Lists link requests for a school (admin view), optionally filtered by
 * status. "expired" is a computed value: a pending request whose expiry
 * is past is displayed as expired. RLS keeps this admin-only.
 */
export async function listLinkRequests(
  schoolId: string,
  status?: LinkRequestListItem["status"]
): Promise<LinkRequestListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("student_link_requests")
    .select(
      "id, status, created_at, expires_at, resolved_at, reason, parents(first_name, last_name), students(first_name, last_name, matricule)"
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status === "expired") {
    query = query.eq("status", "pending");
  } else if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  const now = Date.now();

  return (data as unknown as {
    id: string;
    status: "pending" | "approved" | "rejected";
    created_at: string;
    expires_at: string;
    resolved_at: string | null;
    reason: string | null;
    parents: { first_name: string; last_name: string } | null;
    students: { first_name: string; last_name: string; matricule: string } | null;
  }[]).map((r) => {
    const expiresAt = new Date(r.expires_at).getTime();
    const displayStatus =
      r.status === "pending" && expiresAt < now ? "expired" : r.status;

    return {
      id: r.id,
      status: displayStatus,
      created_at: r.created_at,
      expires_at: r.expires_at,
      resolved_at: r.resolved_at,
      reason: r.reason,
      parent_name: r.parents
        ? `${r.parents.first_name} ${r.parents.last_name}`
        : null,
      student_name: r.students
        ? `${r.students.first_name} ${r.students.last_name}`
        : null,
      matricule: r.students?.matricule ?? null,
    };
  });
}