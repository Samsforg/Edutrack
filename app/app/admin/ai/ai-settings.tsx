"use client";

import { useTransition } from "react";
import { runSchoolJobAction } from "./actions";
import { Button } from "@/components/ui/button";
import { AiQuotaPlan } from "@/lib/ai/types";

export function AiSettingsPanel({
  quota,
  usedRequests,
  schoolId,
}: {
  quota: AiQuotaPlan;
  usedRequests: number;
  schoolId: string;
}) {
  const [pending, start] = useTransition();
  void schoolId;

  const run = (job: "detect-attendance-risks" | "detect-performance-risks" | "detect-class-anomalies") =>
    start(() => {
      runSchoolJobAction(job);
    });

  const remaining = Math.max(0, quota.requestsPerMonth - usedRequests);
  const pct = Math.min(100, Math.round((usedRequests / quota.requestsPerMonth) * 100));

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Requêtes IA utilisées ce mois
          </span>
          <span className="font-medium">
            {usedRequests} / {quota.requestsPerMonth}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={pct >= 90 ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-emerald-600"}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <Row k="Insights" v={quota.insights ? "Activés" : "Non"} />
        <Row k="Résumés" v={quota.summaries ? "Activés" : "Non"} />
        <Row k="Assistant" v={quota.assistant ? "Activé" : "Non"} />
      </dl>
      <div>
        <p className="mb-2 text-sm font-medium">Lancer une analyse maintenant</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => run("detect-attendance-risks")}>
            Assiduité
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run("detect-performance-risks")}>
            Performance
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run("detect-class-anomalies")}>
            Classes
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Il reste {remaining} requêtes ce mois.</p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{k}</p>
      <p className="font-medium">{v}</p>
    </div>
  );
}
