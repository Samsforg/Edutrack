"use server";

import { requireRole } from "@/lib/auth/guard";
import { setFeatureFlag } from "@/lib/ai/store";
import { enqueueJob, type JobType } from "@/lib/ai/jobs/queue";
import type { RolloutLevel } from "@/lib/ai/types";

export async function updateFlagAction(key: string, rollout: RolloutLevel) {
  await requireRole(["SUPER_ADMIN"]);
  await setFeatureFlag(key, rollout, null);
}

export async function runJobAction(jobType: JobType) {
  await requireRole(["SUPER_ADMIN"]);
  await enqueueJob(jobType, null);
}
