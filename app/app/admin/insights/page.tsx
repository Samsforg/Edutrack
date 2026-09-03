import { requireRole } from "@/lib/auth/guard";
import { listInsights } from "@/lib/ai/store";
import { INSIGHT_TYPE_LABELS, SEVERITY_LABELS, SEVERITY_BADGE } from "@/lib/ai/ui";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusActions } from "./status-actions";

export const dynamic = "force-dynamic";

export default async function AdminInsightsPage() {
  const session = await requireRole(["SCHOOL_ADMIN"]);
  const schoolId =
    session.memberships.find((m) => m.role === "SCHOOL_ADMIN")?.school_id ?? "";

  const insights = await listInsights({ schoolId, limit: 100 });

  const active = insights.filter((i) => i.status === "active").length;
  const urgent = insights.filter(
    (i) => i.status === "active" && (i.severity === "critical" || i.severity === "high")
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Intelligence</h1>
          <p className="text-muted-foreground">
            Signaux détectés par le moteur de risque (statistique, multicolore).
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{active} actifs</Badge>
          <Badge variant="destructive">{urgent} à traiter</Badge>
        </div>
      </div>

      {insights.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Aucun insight pour le moment — ils apparaîtront après les premières analyses.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {insights.map((i) => (
            <Card key={i.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={SEVERITY_BADGE[i.severity]}>
                    {SEVERITY_LABELS[i.severity]}
                  </Badge>
                  <Badge variant="outline">{INSIGHT_TYPE_LABELS[i.type]}</Badge>
                  <span className="font-semibold">{i.title}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {i.summary ? <CardDescription>{i.summary}</CardDescription> : null}
                {i.recommendation ? (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Recommandation :</span>{" "}
                    {i.recommendation}
                  </p>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Confiance : {i.confidence}%</span>
                  <StatusActions insight={{ id: i.id, status: i.status }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
