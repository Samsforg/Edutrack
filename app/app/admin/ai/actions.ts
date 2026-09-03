"use server";

import { requireRole } from "@/lib/auth/guard";
import { enqueueJob, type JobType } from "@/lib/ai/jobs/queue";

export async function runSchoolJobAction(jobType: JobType) {
  const session = await requireRole(["SCHOOL_ADMIN"]);
  const schoolId = session.memberships.find((m) => m.role === "SCHOOL_ADMIN")?.school_id ?? "";
  if (!schoolId) return { error: "École introuvable." };
  await enqueueJob(jobType, schoolId);
  return { ok: true };
}
