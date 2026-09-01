"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

/**
 * Submits a link request for the calling parent using the code.
 * Delegates to the security-definer RPC so the parent never queries
 * arbitrary students directly.
 */
export async function submitLinkRequest(schoolId: string, code: string) {
  const supabase = await createClient();
  const normalized = code.trim().toUpperCase();

  const { error } = await supabase.rpc("create_link_request", {
    target_school: schoolId,
    code: normalized,
  });

  if (error) {
    const msg = typeof error.message === "string" ? error.message : "";
    if (msg.includes("CODE_NOT_FOUND")) {
      return { error: "Code invalide. Vérifiez le code et réessayez." };
    }
    if (msg.includes("PENDING_EXISTS")) {
      return {
        error: "Une demande est déjà en attente pour cet enfant.",
      };
    }
    return { error: "Impossible de créer la demande. Réessayez." };
  }

  revalidatePath("/app/parent/link");
  return { ok: true as const };
}

type PublicRequest = {
  id: string;
  code: string;
  status: "pending" | "approved" | "rejected" | "expired";
  created_at: string;
  students: { first_name: string; last_name: string } | null;
};

/**
 * Returns the link requests visible to the calling parent.
 */
export async function getLinkedRequests(): Promise<PublicRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_link_requests")
    .select(
      "id, code, status, created_at, parent_id, students(first_name, last_name)"
    )
    .order("created_at", { ascending: false });

  if (!data) return [];

  // RLS guarantees we only see our own requests (parent) or admin-visible
  // ones. Keep the shape minimal.
  return (data as unknown as PublicRequest[]).map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    created_at: r.created_at,
    students: r.students,
  }));
}

/**
 * Approves a pending link request: inserts the student-parent link and
 * marks the request approved. Only usable by a school admin (RLS).
 */
export async function approveLinkRequest(requestId: string) {
  const supabase = await createClient();

  const { data: request, error: fetchError } = await supabase
    .from("student_link_requests")
    .select("id, student_id, parent_id")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchError || !request) {
    return { error: "Demande introuvable." };
  }

  if (request.parent_id) {
    const { error: spError } = await supabase
      .from("student_parents")
      .insert({ student_id: request.student_id, parent_id: request.parent_id })
      .select("id")
      .maybeSingle();

    if (spError) {
      return { error: "La liaison existe déjà ou a échoué." };
    }
  }

  const { error: upError } = await supabase
    .from("student_link_requests")
    .update({ status: "approved" })
    .eq("id", requestId);

  if (upError) {
    return { error: "Impossible d'approuver la demande." };
  }

  revalidatePath("/app/admin/link-requests");
  return { ok: true as const };
}

export async function rejectLinkRequest(requestId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("student_link_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);
  if (error) {
    return { error: "Impossible de rejeter la demande." };
  }
  revalidatePath("/app/admin/link-requests");
  return { ok: true as const };
}