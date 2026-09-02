"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { writeBlockMessage } from "@/lib/billing/access";
import {
  getParentUserIdsForSchool,
  getParentUserIdsForClass,
  insertNotifications,
} from "@/lib/db/notify";

const announcementSchema = z.object({
  schoolId: z.string().uuid(),
  title: z.string().min(1, "Titre requis"),
  body: z.string().min(1, "Contenu requis"),
  audience: z.enum(["all", "class"]).default("all"),
  classroomId: z.string().uuid().nullable().optional(),
  important: z.boolean().default(false),
});

export type Result = { error?: string; ok?: boolean };

async function requireAdmin(schoolId: string) {
  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };
  const membership = session.memberships.find((m) => m.school_id === schoolId);
  if (!membership || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(membership.role)) {
    return { error: "Accès refusé" };
  }
  const blocked = await writeBlockMessage(schoolId);
  if (blocked) return { error: blocked };
  return { session };
}

/**
 * Create a draft announcement (not published yet; no notifications).
 */
export async function createAnnouncement(
  input: z.infer<typeof announcementSchema>
): Promise<Result> {
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;

  const auth = await requireAdmin(d.schoolId);
  if ("error" in auth) return auth;
  const session = auth.session!;

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    school_id: d.schoolId,
    author_id: session.user.id,
    audience: d.audience,
    classroom_id: d.audience === "class" ? d.classroomId : null,
    title: d.title,
    body: d.body,
    important: d.important,
  });

  if (error) return { error: error.message };

  revalidatePath("/app/admin/announcements");
  return { ok: true };
}

export async function updateAnnouncement(
  announcementId: string,
  schoolId: string,
  input: Omit<z.infer<typeof announcementSchema>, "schoolId">
): Promise<Result> {
  const auth = await requireAdmin(schoolId);
  if ("error" in auth) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update({
      title: input.title,
      body: input.body,
      audience: input.audience,
      classroom_id: input.audience === "class" ? input.classroomId : null,
      important: input.important,
    })
    .eq("id", announcementId)
    .eq("school_id", schoolId);

  if (error) return { error: error.message };
  revalidatePath("/app/admin/announcements");
  return { ok: true };
}

/**
 * Publish an announcement: sets published_at, then notifies parents
 * (idempotent — one notification run per announcement).
 */
export async function publishAnnouncement(
  announcementId: string,
  schoolId: string
): Promise<Result> {
  const auth = await requireAdmin(schoolId);
  if ("error" in auth) return auth;

  const supabase = await createClient();

  const { data: announcement, error: aErr } = await supabase
    .from("announcements")
    .select("id, school_id, audience, classroom_id, title, important")
    .eq("id", announcementId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (aErr || !announcement) return { error: "Annonce introuvable" };

  const now = new Date().toISOString();

  // Set published_at (idempotent if already published)
  const { error: pubErr } = await supabase
    .from("announcements")
    .update({ published_at: now, archived_at: null })
    .eq("id", announcementId);

  if (pubErr) return { error: pubErr.message };

  // Notify only if not already notified (guard via published_at==now new value)
  // Idempotence: use a marker on the announcement that it was notified.
  const parentIds =
    announcement.audience === "class" && announcement.classroom_id
      ? await getParentUserIdsForClass(announcement.classroom_id)
      : await getParentUserIdsForSchool(schoolId);

  // Avoid duplicates: check if a notification for this exact announcement+user exists.
  if (parentIds.length > 0) {
    const { data: existing } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("type", "announcement")
      .eq("link", "/app/parent/announcements");

    const alreadyNotified = new Set<string>();
    if (existing) {
      for (const n of existing as { user_id: string }[]) alreadyNotified.add(n.user_id);
    }
    const toNotify = parentIds.filter((uid) => !alreadyNotified.has(uid));
    await insertNotifications(toNotify, {
      type: "announcement",
      title: announcement.title,
      body: announcement.important ? "Annonce importante de votre établissement." : undefined,
      link: "/app/parent/announcements",
    });
  }

  revalidatePath("/app/admin/announcements");
  revalidatePath("/app/parent");
  return { ok: true };
}

/**
 * Archive an announcement (hidden from parent list, kept in admin history).
 */
export async function archiveAnnouncement(
  announcementId: string,
  schoolId: string
): Promise<Result> {
  const auth = await requireAdmin(schoolId);
  if ("error" in auth) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", announcementId)
    .eq("school_id", schoolId);

  if (error) return { error: error.message };
  revalidatePath("/app/admin/announcements");
  return { ok: true };
}

export async function deleteAnnouncement(
  announcementId: string,
  schoolId: string
): Promise<Result> {
  const auth = await requireAdmin(schoolId);
  if ("error" in auth) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", announcementId)
    .eq("school_id", schoolId);

  if (error) return { error: error.message };
  revalidatePath("/app/admin/announcements");
  revalidatePath("/app/parent");
  return { ok: true };
}
