"use server";

import { requireRole } from "@/lib/auth/guard";
import { updateInsightStatus } from "@/lib/ai/store";
import type { AiInsightStatus } from "@/lib/ai/types";

export async function updateStatusAction(id: string, status: AiInsightStatus) {
  await requireRole(["SCHOOL_ADMIN"]);
  await updateInsightStatus(id, status);
}
