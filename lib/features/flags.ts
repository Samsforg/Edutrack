/**
 * Feature Flags — Lecture côté serveur (RLS) + cache court.
 *
 * États : disabled | internal | pilot | beta | enabled
 * Priorité : flag école > flag global
 */

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type RolloutLevel = "disabled" | "internal" | "pilot" | "beta" | "enabled";

export const FEATURE_FLAGS = [
  "ai_insights",
  "ai_assistant",
  "ai_summaries",
  "semantic_search",
  "sms",
  "whatsapp",
  "weekly_digest",
  "advanced_analytics",
  "reports_export",
  "realtime_attendance",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[number];

/**
 * Vérifie si un flag est actif pour une école (avec cache requête).
 * Lecture via RLS : admin école voit ses flags, superadmin voit tout.
 */
export const isFeatureEnabled = cache(
  async (key: FeatureFlagKey, schoolId?: string): Promise<boolean> => {
    const supabase = await createClient();
    const query = supabase
      .from("feature_flags")
      .select("key, rollout, school_id")
      .eq("key", key)
      .order("school_id", { ascending: false }); // school_id non-null en premier

    const { data, error } = await query;
    if (error || !data || data.length === 0) return false;

    const rows = data as { key: string; rollout: RolloutLevel; school_id: string | null }[];
    const global = rows.find((r) => r.school_id === null);
    const specific = schoolId ? rows.find((r) => r.school_id === schoolId) : undefined;

    const level = specific?.rollout ?? global?.rollout ?? "disabled";
    return level === "enabled" || level === "beta" || level === "pilot";
  }
);

/**
 * Récupère tous les flags (pour super-admin UI)
 */
export async function getAllFeatureFlags(): Promise<
  { id: string; key: string; rollout: RolloutLevel; schoolId: string | null }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_flags")
    .select("id, key, rollout, school_id")
    .order("key");
  if (error || !data) return [];
  return (data as { id: string; key: string; rollout: RolloutLevel; school_id: string | null }[]).map(
    (r) => ({ id: r.id, key: r.key, rollout: r.rollout, schoolId: r.school_id })
  );
}

/**
 * Met à jour un flag (service role / super admin uniquement)
 */
export async function setFeatureFlag(
  key: string,
  rollout: RolloutLevel,
  schoolId: string | null = null
): Promise<{ error?: string }> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { error } = await supabase.from("feature_flags").upsert(
    {
      key,
      rollout,
      school_id: schoolId ?? undefined,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key,school_id" }
  );
  return error ? { error: error.message } : {};
}

/**
 * Hook client-side (pour composants) — appelle server action
 * À utiliser via `useFeatureFlag(key)` dans un Client Component
 */
export async function checkFeatureFlagServer(key: FeatureFlagKey, schoolId?: string): Promise<boolean> {
  return isFeatureEnabled(key, schoolId);
}

/**
 * Niveau de rollout ordonné pour comparaison
 */
export const ROLLOUT_ORDER: Record<RolloutLevel, number> = {
  disabled: 0,
  internal: 1,
  pilot: 2,
  beta: 3,
  enabled: 4,
};

export function isRolloutAtLeast(current: RolloutLevel, required: RolloutLevel): boolean {
  return ROLLOUT_ORDER[current] >= ROLLOUT_ORDER[required];
}

/**
 * Labels FR pour UI
 */
export const ROLLOUT_LABELS: Record<RolloutLevel, string> = {
  disabled: "Désactivé",
  internal: "Interne",
  pilot: "Pilote",
  beta: "Bêta",
  enabled: "Activé",
};