import { createAdminClient } from "@/lib/supabase/admin";
import {
  detectAttendanceRisks,
  detectPerformanceRisks,
  detectClassAnomalies,
  cleanupExpiredInsights,
} from "@/lib/ai/jobs/detect";

/**
 * File de jobs asynchrones (PGMQ-style simplifiée sur ai_job_queue).
 * - enqueue : ajoute un job
 * - runPendingJobs : exécute les jobs dus, avec retry (max_attempts)
 * Conçu pour être appelé par une Edge Function / cron, jamais pendant le rendu.
 */

export type JobType =
  | "detect-attendance-risks"
  | "detect-performance-risks"
  | "detect-class-anomalies"
  | "generate-weekly-digests"
  | "cleanup-expired-insights";

export async function enqueueJob(
  jobType: JobType,
  schoolId: string | null,
  payload: Record<string, unknown> = {},
  runAt: string = new Date().toISOString()
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("ai_job_queue").insert({
    job_type: jobType,
    school_id: schoolId,
    payload: payload as never,
    status: "pending",
    run_at: runAt,
  });
  return error ? { error: error.message } : {};
}

async function runJob(jobType: JobType, schoolId: string | null): Promise<number> {
  if (jobType === "cleanup-expired-insights") {
    return cleanupExpiredInsights();
  }
  if (!schoolId) return 0;
  switch (jobType) {
    case "detect-attendance-risks":
      return detectAttendanceRisks(schoolId);
    case "detect-performance-risks":
      return detectPerformanceRisks(schoolId);
    case "detect-class-anomalies":
      return detectClassAnomalies(schoolId);
    case "generate-weekly-digests":
      // Les digest sont traités par le module weekly (PUSH côté serveur).
      return 0;
    default:
      return 0;
  }
}

/** Exécute jusqu'à `limit` jobs dus. Retry si échec (attempts < max_attempts). */
export async function runPendingJobs(limit = 10): Promise<{ processed: number; failed: number }> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ai_job_queue")
    .select("id, job_type, school_id, payload, attempts, max_attempts")
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  const jobs = (data as unknown as {
    id: string;
    job_type: JobType;
    school_id: string | null;
    attempts: number;
    max_attempts: number;
  }[]) ?? [];

  let processed = 0;
  let failed = 0;
  for (const job of jobs) {
    const nextAttempts = job.attempts + 1;
    try {
      await supabase
        .from("ai_job_queue")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", job.id);
      await runJob(job.job_type, job.school_id);
      await supabase
        .from("ai_job_queue")
        .update({ status: "completed", attempts: nextAttempts, updated_at: new Date().toISOString() })
        .eq("id", job.id);
      processed++;
    } catch (e) {
      failed++;
      const msg = (e as Error).message;
      const giveUp = nextAttempts >= job.max_attempts;
      await supabase
        .from("ai_job_queue")
        .update({
          status: giveUp ? "failed" : "pending",
          attempts: nextAttempts,
          last_error: msg,
          run_at: new Date(Date.now() + 15 * 60000).toISOString(), // retry in 15 min
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  }
  return { processed, failed };
}
