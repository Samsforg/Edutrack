"use server";

import { requireRole } from "@/lib/auth/guard";
import { getCommunicationPreferences, updateCommunicationPreferences } from "@/lib/ai/store";

export async function getCommPrefs() {
  const session = await requireRole(["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "PARENT"]);
  return getCommunicationPreferences(session.user.id);
}

export async function updateCommPrefs(prefs: Partial<{ smsEnabled: boolean; whatsappEnabled: boolean; emailEnabled: boolean; pushEnabled: boolean }>) {
  const session = await requireRole(["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "PARENT"]);
  const primarySchool = session.memberships[0]?.school_id ?? null;
  return updateCommunicationPreferences(session.user.id, primarySchool, prefs);
}