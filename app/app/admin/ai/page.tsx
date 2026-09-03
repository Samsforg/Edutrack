import { requireRole } from "@/lib/auth/guard";
import { getAiUsage } from "@/lib/ai/store";
import { AI_QUOTAS } from "@/lib/ai/risk/config";
import { AiSettingsPanel } from "./ai-settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminAiSettingsPage() {
  const session = await requireRole(["SCHOOL_ADMIN"]);
  const schoolId = session.memberships.find((m) => m.role === "SCHOOL_ADMIN")?.school_id ?? "";
  const usage = await getAiUsage(schoolId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Intelligence & automatisation</h1>
        <p className="text-muted-foreground">
          Quotas, lancement des analyses et comportement des alertes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quotas IA (plan Standard)</CardTitle>
          <CardDescription>Limites d&apos;usage mensuelles du moteur d&apos;intelligence.</CardDescription>
        </CardHeader>
        <CardContent>
          <AiSettingsPanel
            quota={AI_QUOTAS["standard"]}
            usedRequests={usage?.requestsMonth ?? 0}
            schoolId={schoolId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
