import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/guard";
import { getSchoolSubscription } from "@/lib/db/billing";
import { getUsageAndLimits } from "@/lib/billing/entitlements";
import { decideAccess } from "@/lib/billing/entitlements";
import { PLAN_LIST, formatPrice, TRIAL_DAYS } from "@/lib/billing/plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BillingClient } from "./billing-client";

/** Résout l'école active du SCHOOL_ADMIN courant (depuis la session). */
async function resolveSchoolId() {
  const session = await requireRole(["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  const schoolId = session.memberships.find(
    (m) => m.role === "SCHOOL_ADMIN" && m.school_status === "active"
  )?.school_id;
  if (!schoolId) throw new Error("Aucune école active pour ce compte.");
  return { schoolId, session };
}

const STATUS_LABEL: Record<string, string> = {
  trialing: "Essai gratuit",
  active: "Actif",
  past_due: "Paiement en attente",
  canceled: "Résilié",
  expired: "Expiré",
  suspended: "Suspendu",
};

export default async function SchoolBillingPage() {
  const { schoolId } = await resolveSchoolId();

  const [sub, usage] = await Promise.all([
    getSchoolSubscription(schoolId),
    getUsageAndLimits(schoolId),
  ]);
  const decision = decideAccess(sub);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Abonnement & facturation</h1>
        <p className="text-muted-foreground">
          Gérez votre plan, votre essai gratuit et les limites de votre établissement.
        </p>
      </div>

      {decision.readOnly && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <strong>Votre abonnement a expiré.</strong> Vous pouvez consulter vos données
          mais pas en créer de nouvelles. Renouvelez votre abonnement ci-dessous.
        </div>
      )}
      {decision.status === "trialing" && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
          <strong>Période d&apos;essai :</strong>{" "}
          {sub?.trialEndsAt
            ? `se termine le ${new Date(sub.trialEndsAt).toLocaleDateString("fr-FR")}`
            : `${TRIAL_DAYS} jours`}
          . Choisissez un plan pour continuer.
        </div>
      )}
      {decision.status === "past_due" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Paiement en attente.</strong> Régularisez votre abonnement pour
          éviter une suspension.
        </div>
      )}
      {decision.status === "canceled" && (
        <div className="rounded-md border border-muted p-4 text-sm">
          <strong>Abonnement résilié.</strong> Vous gardez accès jusqu&apos;à la fin de
          la période payée. Reprenez votre abonnement pour ne pas perdre l&apos;accès.
        </div>
      )}

      {/* Plan actuel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Votre plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold">{sub?.planName ?? "—"}</p>
                <p className="text-sm text-muted-foreground">
                  {sub ? formatPrice(sub.planPrice) + " / an" : "—"}
                </p>
              </div>
              {sub && (
                <Badge
                  variant={
                    ["active", "trialing"].includes(decision.status)
                      ? "default"
                      : "secondary"
                  }
                >
                  {STATUS_LABEL[decision.status] ?? decision.status}
                </Badge>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Élèves</span>
                <span>
                  {usage.students} / {usage.studentsLimit || "∞"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enseignants</span>
                <span>
                  {usage.teachers} / {usage.teachersLimit || "∞"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Admins</span>
                <span>
                  {usage.admins} / {usage.adminsLimit || "∞"}
                </span>
              </div>
            </div>

            {sub?.currentPeriodEnd && (
              <p className="pt-2 text-xs text-muted-foreground">
                Période jusqu&apos;au{" "}
                {new Date(sub.currentPeriodEnd).toLocaleDateString("fr-FR")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Changement de plan */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Changer de plan</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<p>Chargement…</p>}>
              <BillingClient
                plans={PLAN_LIST.map((p) => ({
                  code: p.code,
                  name: p.name,
                  priceLabel: formatPrice(p.price),
                  maxStudents: p.maxStudents,
                  maxTeachers: p.maxTeachers,
                  maxAdmins: p.maxAdmins,
                  isDefault: p.isDefault,
                }))}
                currentPlan={sub?.planCode ?? null}
                cancelAtPeriodEnd={sub?.cancelAtPeriodEnd ?? false}
                providerConfigured={!!process.env.PAYMENT_PROVIDER}
              />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        Des besoins spécifiques ?{" "}
        <Link href="/contact" className="underline">
          Contactez notre équipe
        </Link>
        .
      </p>
    </div>
  );
}
