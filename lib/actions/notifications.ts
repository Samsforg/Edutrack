"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

const notifIdSchema = z.object({ id: z.string().uuid() });

export type MarkResult = { ok?: boolean; error?: string };

/**
 * Marks a single notification as read. RLS `notifications_own` guarantees
 * the caller can only ever touch their own notifications.
 */
export async function markNotificationRead(
  input: z.infer<typeof notifIdSchema>
): Promise<MarkResult> {
  const parsed = notifIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Identifiant invalide" };

  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  return { ok: !!data };
}

/**
 * Marks all of the caller's unread notifications as read.
 */
export async function markAllNotificationsRead(): Promise<MarkResult> {
  const session = await getSession();
  if (!session?.user) return { error: "Non authentifié" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", session.user.id)
    .is("read_at", null);

  if (error) return { error: error.message };
  revalidatePath("/app/parent/notifications");
  return { ok: true };
}