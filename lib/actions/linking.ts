"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import {
  generateCodeSalt,
  generateLinkCode,
  hashLinkCode,
  isValidLinkCode,
} from "@/lib/link-codes";
import type { VerifiedLinkCode } from "@/types/student-link";

const CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ActionResult = {
  ok?: boolean;
  error?: string;
  data?: unknown;
};

const codeSchema = z
  .string()
  .trim()
  .min(1, "Code requis")
  .refine(isValidLinkCode, "Format invalide. Attendu : EDU-XXXX-XXXX.");

const rejectSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().trim().max(300, "Motif trop long").optional().or(z.literal("")),
});

function mapRpcError(message: string, fallback: string): string {
  if (message.includes("RATE_LIMITED")) {
    return "Trop de tentatives. Réessayez dans quelques minutes.";
  }
  if (message.includes("CODE_NOT_FOUND")) {
    return "Code invalide, expiré ou déjà utilisé.";
  }
  if (message.includes("PENDING_EXISTS")) {
    return "Une demande est déjà en attente pour cet enfant.";
  }
  if (message.includes("NOT_FOUND")) {
    return "Demande introuvable.";
  }
  if (message.includes("NOT_PENDING")) {
    return "La demande ne peut plus être modifiée.";
  }
  if (message.includes("EXPIRED")) {
    return "La demande a expiré.";
  }
  if (message.includes("NOT_ALLOWED")) {
    return "Action non autorisée.";
  }
  return fallback;
}

function requireAdmin(session: Awaited<ReturnType<typeof getSession>>, schoolId: string) {
  const m = session?.memberships.find((x) => x.school_id === schoolId);
  if (!m || m.role !== "SCHOOL_ADMIN") return false;
  return true;
}

/**
 * Generates a fresh, hashed link code for a student and stores ONLY
 * its salted SHA-256 hash. Reuses the void slot of a hashed code that
 * has just been revoked on this student (structure allows it; the UI
 * relies on revalidation). Only a SCHOOL_ADMIN of the school may act.
 */
export async function generateStudentLinkCode(
  studentId: string,
  schoolId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Non authentifié." };
  if (!requireAdmin(session, schoolId)) return { ok: false, error: "Accès refusé." };

  const code = generateLinkCode();
  const salt = generateCodeSalt();

  const supabase = await createClient();
  const { error } = await supabase.from("student_link_codes").insert({
    school_id: schoolId,
    student_id: studentId,
    code_salt: salt,
    code_hash: hashLinkCode(code, salt),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    created_by: session.user.id,
  });

  if (error) {
    if (error.code === "23505") {
      // Extremely unlikely collision — regenerate once.
      return generateStudentLinkCode(studentId, schoolId);
    }
    return { ok: false, error: "Impossible de générer le code." };
  }

  revalidatePath("/app/admin/students");
  revalidatePath(`/app/admin/students/${studentId}`);
  return { ok: true, data: { code } };
}

/**
 * Revokes an active link code. Admin only.
 */
export async function revokeStudentLinkCode(
  codeId: string,
  schoolId: string,
  reason = ""
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Non authentifié." };
  if (!requireAdmin(session, schoolId)) return { ok: false, error: "Accès refusé." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_link_codes")
    .select("student_id")
    .eq("id", codeId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error || !data) return { ok: false, error: "Code introuvable." };

  const { error: upError } = await supabase
    .from("student_link_codes")
    .update({ revoked_at: new Date().toISOString(), revoke_reason: reason.trim() || null })
    .eq("id", codeId)
    .eq("school_id", schoolId)
    .eq("revoked_at", null);

  if (upError) return { ok: false, error: "Impossible de révoquer le code." };

  revalidatePath("/app/admin/students");
  revalidatePath(`/app/admin/students/${data.student_id}`);
  return { ok: true };
}

/**
 * Verifies a link code (rate-limited server-side) WITHOUT consuming it.
 * Returns a minimal confirmation (student name + school) — never the
 * matricule, class or establishment id.
 */
export async function verifyStudentLinkCode(
  code: string
): Promise<ActionResult> {
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Code invalide" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_link_code", {
    p_code: parsed.data,
  });

  if (error) {
    return { ok: false, error: mapRpcError(error.message, "Code invalide, expiré ou déjà utilisé.") };
  }

  const rows = data as unknown as
    | {
        student_id: string;
        school_id: string;
        first_name: string;
        last_name: string;
        school_name: string;
      }[]
    | null;

  if (!rows || rows.length === 0) {
    return { ok: false, error: "Code invalide, expiré ou déjà utilisé." };
  }

  const verified: VerifiedLinkCode = {
    studentId: rows[0].student_id,
    firstName: rows[0].first_name,
    lastName: rows[0].last_name,
    schoolName: rows[0].school_name,
  };
  return { ok: true, data: verified };
}

/**
 * Creates a pending link request for the calling parent. Validates the
 * code again (single-use, atomically consumed), links the parent row,
 * guards against duplicate pending requests.
 */
export async function createLinkRequest(code: string): Promise<ActionResult> {
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Code invalide" };

  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Non authentifié." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_link_request", {
    p_code: parsed.data,
  });

  if (error) {
    return {
      ok: false,
      error: mapRpcError(error.message, "Impossible de créer la demande."),
    };
  }

  revalidatePath("/app/parent/link-requests");
  revalidatePath("/app/parent");
  return { ok: true, data: (data as unknown[])[0] };
}

/**
 * Approves a pending link request. Atomic (single RPC): inserts the
 * student-parent link, marks the request approved, notifies the parent.
 */
export async function approveLinkRequest(requestId: string): Promise<ActionResult> {
  const parsed = rejectSchema.safeParse({ requestId, reason: "" });
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  return resolveRequest(requestId, "approved");
}

/**
 * Rejects (or, for the owning parent, cancels) a request with an optional
 * reason. Admin may approve or reject; a parent may only cancel their own.
 */
export async function rejectLinkRequest(
  requestId: string,
  reason = ""
): Promise<ActionResult> {
  const parsed = rejectSchema.safeParse({ requestId, reason });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  }
  return resolveRequest(requestId, "rejected", parsed.data.reason);
}

/**
 * Cancels the calling parent's own pending request.
 */
export async function cancelLinkRequest(requestId: string): Promise<ActionResult> {
  const parsed = rejectSchema.safeParse({ requestId, reason: "" });
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  return resolveRequest(requestId, "rejected");
}

/**
 * Shared resolve path: the DB RPC is the single authority for
 * authorization + atomicity (admin approve/reject, owner cancel).
 */
async function resolveRequest(
  requestId: string,
  status: "approved" | "rejected",
  reason = ""
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_link_request", {
    p_request_id: requestId,
    p_status: status,
    p_reason: reason || null,
  });

  if (error) {
    return { ok: false, error: mapRpcError(error.message, "Impossible de traiter la demande.") };
  }

  revalidatePath("/app/admin/link-requests");
  revalidatePath("/app/parent/link-requests");
  revalidatePath("/app/parent");
  return { ok: true };
}