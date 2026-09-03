import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { insightExpiryHours } from "@/lib/ai/risk/detect";
import type {
  AiAuditEntry,
  AiInsight,
  AiInsightStatus,
  AiUsage,
  CommunicationPreferences,
  FeatureFlagKey,
  RolloutLevel,
} from "@/lib/ai/types";

/**
 * Couche de persistance des insights, de l'usage et de l'audit IA.
 * - ai_insights : écrits via service role (système), lus via client RLS.
 * - ai_usage / ai_audit_logs : écrits via service role.
 * - déduplication : clé unique sur l'insight encore actif.
 */

function iso(d: Date = new Date()): string {
  return d.toISOString();
}

export type StoredInsight = Omit<AiInsight, "id" | "createdAt" | "generatedAt"> & {
  generatedAt?: string;
};

/** Insère un insight avec déduplication (service role). */
export async function insertInsight(
  draft: StoredInsight,
  ttlHours: number = insightExpiryHours()
): Promise<{ inserted: boolean; id?: string }> {
  const supabase = createAdminClient();

  // Déduplication : évite les alertes répétitives (§10).
  const { data: dup } = await supabase
    .from("ai_insights")
    .select("id")
    .eq("dedup_key", draft.dedupKey)
    .eq("status", "active")
    .limit(1);
  if (Array.isArray(dup) && dup.length > 0) {
    return { inserted: false, id: (dup[0] as { id: string }).id };
  }

  const expiresAt = ttlHours ? iso(new Date(Date.now() + ttlHours * 3600000)) : null;
  const { data, error } = await supabase
    .from("ai_insights")
    .insert({
      school_id: draft.schoolId,
      student_id: draft.studentId ?? null,
      class_id: draft.classId ?? null,
      type: draft.type,
      severity: draft.severity,
      title: draft.title,
      summary: draft.summary ?? null,
      evidence: draft.evidence as never,
      recommendation: draft.recommendation ?? null,
      confidence: draft.confidence,
      status: draft.status ?? "active",
      dedup_key: draft.dedupKey,
      generated_at: draft.generatedAt ?? iso(),
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error) return { inserted: false };
  return { inserted: true, id: (data as { id: string }).id };
}

/** Liste les insights actifs d'une école (via RLS : filtré par rôle). */
export async function listInsights(opts: {
  schoolId?: string;
  studentId?: string;
  classId?: string;
  status?: AiInsightStatus;
  limit?: number;
}): Promise<AiInsight[]> {
  const supabase = await createClient();
  let q = supabase
    .from("ai_insights")
    .select("id, school_id, student_id, class_id, type, severity, title, summary, evidence, recommendation, confidence, status, dedup_key, generated_at, expires_at, created_at");

  if (opts.schoolId) q = q.eq("school_id", opts.schoolId);
  if (opts.studentId) q = q.eq("student_id", opts.studentId);
  if (opts.classId) q = q.eq("class_id", opts.classId);
  if (opts.status) q = q.eq("status", opts.status);
  q = q.order("generated_at", { ascending: false }).limit(opts.limit ?? 50);

  const { data, error } = await q;
  if (error || !data) return [];
  return (data as unknown as Record<string, unknown>[]).map((r) => mapInsight(r));
}

/** Met à jour le statut d'un insight (acknowledged/resolved/dismissed). */
export async function updateInsightStatus(
  insightId: string,
  status: AiInsightStatus
): Promise<{ error?: string }> {
  const supabase = await createClient();
  // RLS autorise le school admin à mettre à jour ses insights (statut).
  const { error } = await supabase
    .from("ai_insights")
    .update({ status })
    .eq("id", insightId);
  return error ? { error: error.message } : {};
}

function mapInsight(r: Record<string, unknown>): AiInsight {
  return {
    id: String(r.id),
    schoolId: String(r.school_id),
    studentId: r.student_id ? String(r.student_id) : null,
    classId: r.class_id ? String(r.class_id) : null,
    type: r.type as AiInsight["type"],
    severity: r.severity as AiInsight["severity"],
    title: String(r.title),
    summary: r.summary ? String(r.summary) : null,
    evidence: (r.evidence as Record<string, unknown>) ?? {},
    recommendation: r.recommendation ? String(r.recommendation) : null,
    confidence: Number(r.confidence),
    status: r.status as AiInsight["status"],
    dedupKey: String(r.dedup_key),
    generatedAt: String(r.generated_at),
    expiresAt: r.expires_at ? String(r.expires_at) : null,
    createdAt: String(r.created_at),
  };
}

/** Incrémente les compteurs d'usage IA d'une école (service role). */
export async function bumpAiUsage(
  schoolId: string,
  delta: { requests?: number; summaries?: number; insights?: number; tokens?: number }
): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ai_usage")
    .select("id, requests_day, requests_month, summaries, insights, tokens_used")
    .eq("school_id", schoolId)
    .maybeSingle();

  if (data) {
    await supabase
      .from("ai_usage")
      .update({
        requests_day: (data as Record<string, unknown>).requests_day as number + (delta.requests ?? 0),
        requests_month: (data as Record<string, unknown>).requests_month as number + (delta.requests ?? 0),
        summaries: (data as Record<string, unknown>).summaries as number + (delta.summaries ?? 0),
        insights: (data as Record<string, unknown>).insights as number + (delta.insights ?? 0),
        tokens_used: (data as Record<string, unknown>).tokens_used as number + (delta.tokens ?? 0),
        updated_at: iso(),
      })
      .eq("school_id", schoolId);
  } else {
    await supabase.from("ai_usage").insert({
      school_id: schoolId,
      requests_day: delta.requests ?? 0,
      requests_month: delta.requests ?? 0,
      summaries: delta.summaries ?? 0,
      insights: delta.insights ?? 0,
      tokens_used: delta.tokens ?? 0,
    });
  }
}

/** Lit l'usage IA d'une école (via RLS, admin). */
export async function getAiUsage(schoolId: string): Promise<AiUsage | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_usage")
    .select("requests_day, requests_month, summaries, insights, tokens_used")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as Record<string, unknown>;
  return {
    requestsDay: Number(r.requests_day),
    requestsMonth: Number(r.requests_month),
    summaries: Number(r.summaries),
    insights: Number(r.insights),
    tokensUsed: Number(r.tokens_used),
  };
}

/** Enregistre un appel IA dans ai_audit_logs (service role, métadonnées uniquement). */
export async function recordAiAudit(entry: AiAuditEntry): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("ai_audit_logs").insert({
    school_id: entry.schoolId ?? null,
    user_id: entry.userId ?? null,
    action: entry.action,
    model: entry.model ?? null,
    input_type: entry.inputType ?? null,
    output_type: entry.outputType ?? null,
    latency_ms: entry.latencyMs ?? null,
    tokens_used: entry.tokensUsed ?? null,
  });
}

/** Lecture des préférences de communication d'un utilisateur (RLS). */
export async function getCommunicationPreferences(
  userId: string
): Promise<CommunicationPreferences | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("communication_preferences")
    .select("sms_enabled, whatsapp_enabled, email_enabled, push_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as Record<string, unknown>;
  return {
    smsEnabled: Boolean(r.sms_enabled),
    whatsappEnabled: Boolean(r.whatsapp_enabled),
    emailEnabled: Boolean(r.email_enabled),
    pushEnabled: Boolean(r.push_enabled),
  };
}

/** Met à jour les préférences de communication (RLS : l'utilisateur sur lui-même). */
export async function updateCommunicationPreferences(
  userId: string,
  schoolId: string | null,
  prefs: Partial<CommunicationPreferences>
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("communication_preferences").upsert(
    {
      user_id: userId,
      school_id: schoolId ?? undefined,
      sms_enabled: prefs.smsEnabled,
      whatsapp_enabled: prefs.whatsappEnabled,
      email_enabled: prefs.emailEnabled,
      push_enabled: prefs.pushEnabled,
      updated_at: iso(),
    },
    { onConflict: "user_id,school_id" }
  );
  return error ? { error: error.message } : {};
}

/** Vérifie le rollout d'un feature flag (global; optionnellement par école). */
export async function isFeatureEnabled(
  key: FeatureFlagKey,
  schoolId?: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_flags")
    .select("key, rollout, school_id")
    .eq("key", key)
    .order("school_id", { ascending: false });
  if (error || !data) return false;
  const rows = data as unknown as {
    key: string;
    rollout: RolloutLevel;
    school_id: string | null;
  }[];
  // flag global
  const global = rows.find((r) => r.school_id === null);
  // flag spécifique école (prioritaire si présent)
  const specific = schoolId ? rows.find((r) => r.school_id === schoolId) : undefined;

  const level = specific?.rollout ?? global?.rollout ?? "disabled";
  return level === "enabled" || level === "beta" || level === "pilot";
}

/** Met à jour un feature flag (service role / super admin). */
export async function setFeatureFlag(
  key: string,
  rollout: RolloutLevel,
  schoolId: string | null = null
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("feature_flags").upsert(
    {
      key,
      rollout,
      school_id: schoolId ?? undefined,
      updated_at: iso(),
    },
    { onConflict: "key" }
  );
  return error ? { error: error.message } : {};
}

/** Liste tous les feature flags (service role). */
export async function listFeatureFlags(): Promise<
  { id: string; key: string; rollout: RolloutLevel; schoolId: string | null }[]
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("feature_flags")
    .select("id, key, rollout, school_id")
    .order("key");
  if (error || !data) return [];
  return (data as unknown as { id: string; key: string; rollout: RolloutLevel; school_id: string | null }[]).map(
    (r) => ({ id: r.id, key: r.key, rollout: r.rollout, schoolId: r.school_id })
  );
}

/** Liste l'usage IA de toutes les écoles (super admin). */
export async function listAllUsage(): Promise<
  { schoolId: string; requestsMonth: number; summaries: number; insights: number }[]
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_usage")
    .select("school_id, requests_month, summaries, insights")
    .order("requests_month", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as { school_id: string; requests_month: number; summaries: number; insights: number }[]).map(
    (r) => ({ schoolId: r.school_id, requestsMonth: r.requests_month, summaries: r.summaries, insights: r.insights })
  );
}

/** Liste les N derniers insights globaux (super admin). */
export async function listGlobalInsights(limit = 50): Promise<AiInsight[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_insights")
    .select("id, school_id, student_id, class_id, type, severity, title, summary, evidence, recommendation, confidence, status, dedup_key, generated_at, expires_at, created_at")
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as unknown as Record<string, unknown>[]).map((r) => mapInsight(r));
}
