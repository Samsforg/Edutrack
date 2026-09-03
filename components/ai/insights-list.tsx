import { INSIGHT_TYPE_LABELS, SEVERITY_LABELS, SEVERITY_BADGE } from "@/lib/ai/ui";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AiInsight } from "@/lib/ai/types";

/** Liste read-only d'insights (utilisée par teacher / parent / rapports). */
export function InsightsList({
  insights,
  empty = "Aucun signal pour le moment.",
}: {
  insights: AiInsight[];
  empty?: string;
}) {
  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">{empty}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {insights.map((i) => (
        <Card key={i.id}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={SEVERITY_BADGE[i.severity]}>{SEVERITY_LABELS[i.severity]}</Badge>
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
