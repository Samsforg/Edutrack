"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
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

export async function createAnnouncement(
  input: z.infer<typeof announcementSchema>
): Promise<Result> {
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;

  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };
  const membership = session.memberships.find(
    (m) => m.school_id === d.schoolId
  );
  if (!membership || membership.role !== "SCHOOL_ADMIN") {
    return { error: "Accès refusé" };
  }

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

  // Notify linked parents, school-wide or class-wide.
  const parentIds =
    d.audience === "class" && d.classroomId
      ? await getParentUserIdsForClass(d.classroomId)
      : await getParentUserIdsForSchool(d.schoolId);
  await insertNotifications(parentIds, {
    type: "announcement",
    title: d.title,
    body: d.important ? "Annonce importante de votre établissement." : undefined,
    link: "/app/parent",
  });

  revalidatePath("/app/admin/announcements");
  revalidatePath("/app/parent");
  return { ok: true };
}

export async function deleteAnnouncement(
  announcementId: string,
  schoolId: string
): Promise<Result> {
  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };
  const membership = session.memberships.find((m) => m.school_id === schoolId);
  if (!membership || membership.role !== "SCHOOL_ADMIN") {
    return { error: "Accès refusé" };
  }

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