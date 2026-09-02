import Link from "next/link";
import { decisionLabel } from "@/lib/billing/status-labels";
import { Button } from "@/components/ui/button";

export async function SubscriptionBanner({
  schoolId,
}: {
  schoolId: string;
}) {
  const { getSchoolSubscriptionCached } = await import("@/lib/billing/entitlements");
  const { decideAccess } = await import("@/lib/billing/entitlements");
  const sub = await getSchoolSubscriptionCached(schoolId);
  const decision = decideAccess(sub);

  // Aucun bandeau pour les états normaux.
  if (decision.allowed && !decision.readOnly) return null;

  const isTrial = decision.status === "trialing" && !decision.readOnly;
  const isExpired = decision.readOnly;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm ${
        isExpired
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : isTrial
          ? "border-primary/30 bg-primary/5"
          : "border-amber-300 bg-amber-50 text-amber-800"
      }`}
    >
      <span>{decisionLabel(decision, sub?.trialEndsAt ?? null)}</span>
      <Button asChild variant={isExpired ? "default" : "outline"} size="sm">
        <Link href="/school/billing">
          {isExpired ? "Renouveler mon abonnement" : "Gérer mon abonnement"}
        </Link>
      </Button>
    </div>
  );
}
