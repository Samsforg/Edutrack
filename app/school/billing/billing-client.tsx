"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import {
  changePlan,
  cancelSubscription,
  resumeSubscription,
  requestManualActivation,
} from "@/lib/actions/billing";
import type { PlanCode } from "@/lib/billing/plans";

type PlanOption = {
  code: PlanCode;
  name: string;
  priceLabel: string;
  maxStudents: number;
  maxTeachers: number;
  maxAdmins: number;
  isDefault: boolean;
};

export function BillingClient({
  plans,
  currentPlan,
  cancelAtPeriodEnd,
  providerConfigured,
}: {
  plans: PlanOption[];
  currentPlan: PlanCode | null;
  cancelAtPeriodEnd: boolean;
  providerConfigured: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get("checkout") === "success";
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(
    label: string,
    action: () => Promise<{
      ok?: boolean;
      error?: string;
      manual?: boolean;
      checkoutUrl?: string;
    }>
  ) {
    setBusy(label);
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await action();
      setBusy(null);
      if (res.error && !res.ok) {
        setError(res.error);
        return;
      }
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      if (res.manual) {
        setInfo(
          res.error ||
            "Paiement en ligne non configuré. Activation manuelle demandée."
        );
      } else if (label === "changer-plan") {
        setInfo("Votre plan a été mis à jour.");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          Paiement confirmé. Votre abonnement est actif.
        </div>
      )}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-md bg-muted p-3 text-sm">{info}</div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.code === currentPlan;
          return (
            <Card
              key={p.code}
              className={p.code === "standard" ? "border-primary" : ""}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{p.name}</p>
                  {p.isDefault && <Badge variant="secondary">Populaire</Badge>}
                </div>
                <p className="mt-1 text-2xl font-bold">{p.priceLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {p.maxStudents} élèves · {p.maxTeachers} ens. · {p.maxAdmins} admin(s)
                </p>
                {isCurrent ? (
                  <Button disabled variant="outline" className="mt-3 w-full">
                    <Check className="mr-2 h-4 w-4" /> Plan actuel
                  </Button>
                ) : (
                  <Button
                    className="mt-3 w-full"
                    disabled={isPending}
                    onClick={() =>
                      run("changer-plan", () => changePlan({ planCode: p.code }))
                    }
                  >
                    {busy === "changer-plan" ? "…" : "Choisir ce plan"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Tous les prix sont annuels en FCFA. L&apos;accès parents est gratuit.
      </p>

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        {cancelAtPeriodEnd ? (
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => run("reprendre", resumeSubscription)}
          >
            {busy === "reprendre" ? "…" : "Reprendre mon abonnement"}
          </Button>
        ) : (
          <Button
            variant="ghost"
            disabled={isPending}
            onClick={() => run("annuler", cancelSubscription)}
          >
            {busy === "annuler" ? "…" : "Annuler à la fin de la période"}
          </Button>
        )}
        {!providerConfigured && (
          <Button
            variant="outline"
            disabled={isPending || !!currentPlan}
            onClick={() => run("activation", requestManualActivation)}
          >
            {busy === "activation" ? "…" : "Activation manuelle"}
          </Button>
        )}
      </div>
    </div>
  );
}
