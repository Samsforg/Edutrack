import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Insertion de notifications internes via le client service-role.
 * Utilisé pour les événements comptables (trial, abonnement, expiration)
 * ciblant les administrateurs d'une école et le super admin.
 * Dédoublonnage best-effort : évite de notifier deux fois un même user
 * pour un même (type, link).
 */

async function ensureNotNotifyAlready(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  type: string,
  title: string
): Promise<boolean> {
  const { data } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("title", title)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

export async function notifyBillingUsers(
  userIds: string[],
  input: { type: string; title: string; body?: string; link?: string; priority?: string }
): Promise<void> {
  if (userIds.length === 0) return;
  const supabase = createAdminClient();
  const rows: Array<Record<string, unknown>> = [];
  for (const uid of userIds) {
    if (!uid) continue;
    if (await ensureNotNotifyAlready(supabase, uid, input.type, input.title)) continue;
    rows.push({
      user_id: uid,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      priority: input.priority ?? "normal",
    });
  }
  if (rows.length === 0) return;
  await supabase.from("notifications").insert(rows);
}

/** Ids des SCHOOL_ADMIN / SUPER_ADMIN d'une école (profiles liés à l'école). */
export async function getSchoolAdminUserIds(schoolId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("school_id", schoolId)
    .in("role", ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (error || !data) return [];
  return (data as unknown as { id: string }[]).map((p) => p.id).filter(Boolean);
}

/** Id de tous les super admins (notifications commerciales globales). */
export async function getSuperAdminUserIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "SUPER_ADMIN");
  if (error || !data) return [];
  return (data as unknown as { id: string }[]).map((p) => p.id).filter(Boolean);
}

export const billingNotification = {
  trial: {
    started: (schoolName: string) => ({
      type: "system",
      title: "Essai gratuit démarré",
      body: `Votre essai gratuit de 14 jours est actif pour ${schoolName}.`,
      link: "/school/billing",
    }),
    ending: (schoolName: string) => ({
      type: "system",
      title: "Votre essai se termine bientôt",
      body: `L'essai gratuit de ${schoolName} se termine dans 3 jours.`,
      link: "/school/billing",
    }),
    expired: (schoolName: string) => ({
      type: "system",
      title: "Votre essai a expiré",
      body: `L'essai gratuit de ${schoolName} est terminé.`,
      link: "/school/billing",
    }),
  },
  subscription: {
    started: (schoolName: string) => ({
      type: "system",
      title: "Abonnement activé",
      body: `L'abonnement de ${schoolName} est actif.`,
      link: "/school/billing",
    }),
    renewed: (schoolName: string) => ({
      type: "system",
      title: "Abonnement renouvelé",
      body: `L'abonnement de ${schoolName} a été renouvelé.`,
      link: "/school/billing",
    }),
    canceled: (schoolName: string) => ({
      type: "system",
      title: "Abonnement annulé",
      body: `L'abonnement de ${schoolName} a été annulé.`,
      link: "/school/billing",
    }),
    expiring: (schoolName: string) => ({
      type: "system",
      title: "Abonnement bientôt expiré",
      body: `L'abonnement de ${schoolName} expire dans 3 jours.`,
      link: "/school/billing",
    }),
  },
  usage: {
    limit: (schoolName: string) => ({
      type: "system",
      title: "Limite du plan atteinte",
      body: `${schoolName} a atteint une limite de son plan.`,
      link: "/school/billing",
    }),
  },
};

/**
 * Rappel programme (cron / route métier) : notifie les écoles dont le trial
 * se termine sous 3 jours, une seule fois par (user, type, title).
 * Ne pas appeler dans un render de page (effet de bord).
 */
export async function maybeSendTrialEndingReminders(): Promise<number> {
  const supabase = createAdminClient();
  const in3Days = new Date(Date.now() + 3 * 86400000).toISOString();
  const { data: trials, error } = await supabase
    .from("school_subscriptions")
    .select("school_id")
    .eq("status", "trialing")
    .lte("trial_ends_at", in3Days)
    .not("trial_ends_at", "is", null);
  if (error || !trials) return 0;

  let notified = 0;
  const seen = new Set<string>();
  for (const t of trials as unknown as { school_id: string }[]) {
    if (seen.has(t.school_id)) continue;
    seen.add(t.school_id);
    const { data: school } = await supabase
      .from("schools")
      .select("name")
      .eq("id", t.school_id)
      .maybeSingle();
    const name = (school as { name?: string } | null)?.name ?? "École";
    const admins = await getSchoolAdminUserIds(t.school_id);
    await notifyBillingUsers(admins, billingNotification.trial.ending(name));
    if (admins.length > 0) notified += admins.length;
  }
  return notified;
}
