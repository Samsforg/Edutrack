"use server";

import { requireRole } from "@/lib/auth/guard";
import { askAssistant, type AssistantReply } from "@/lib/ai/assistant";

export async function askSchoolAssistant(question: string): Promise<AssistantReply> {
  const session = await requireRole(["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  const schoolId = session.memberships.find((m) => m.role === "SCHOOL_ADMIN")?.school_id ?? "";
  return askAssistant(
    { userId: session.user.id, schoolId, role: "SCHOOL_ADMIN" },
    question
  );
}
