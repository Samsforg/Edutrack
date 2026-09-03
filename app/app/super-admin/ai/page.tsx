import { requireRole } from "@/lib/auth/guard";
import { listFeatureFlags, listAllUsage, listGlobalInsights } from "@/lib/ai/store";
import { AIControls, JobRunner } from "./ai-controls";
import { InsightsList } from "@/components/ai/insights-list";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SuperAdminAiPage() {
  await requireRole(["SUPER_ADMIN"]);
  const [flags, usage, insights] = await Promise.all([
    listFeatureFlags(),
    listAllUsage(),
    listGlobalInsights(40),
  ]);

  const totalRequests = usage.reduce((n, u) => n + u.requestsMonth, 0);
  const totalInsights = usage.reduce((n, u) => n + u.insights, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pilotage IA</h1>
        <p className="text-muted-foreground">
          Feature flags, quotas, file de jobs et insights globaux.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Kpi label="Requêtes IA / mois" value={String(totalRequests)} />
        <Kpi label="Insights générés" value={String(totalInsights)} />
        <Kpi label="Écoles utilisatrices" value={String(usage.length)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feature flags (rollout global)</CardTitle>
          <CardDescription>Activation progressive des fonctionnalités IA.</CardDescription>
        </CardHeader>
        <CardContent>
          <AIControls flags={flags} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>File de jobs</CardTitle>
          <CardDescription>Lancez une détection ou un nettoyage manuellement.</CardDescription>
        </CardHeader>
        <CardContent>
          <JobRunner />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Derniers insights (toutes écoles)</h2>
        <InsightsList insights={insights} empty="Aucun insight généré." />
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
