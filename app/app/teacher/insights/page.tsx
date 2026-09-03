import { requireRole } from "@/lib/auth/guard";
import { getTeacherClasses } from "@/lib/db/teacher";
import { listInsights } from "@/lib/ai/store";
import { InsightsList } from "@/components/ai/insights-list";

export const dynamic = "force-dynamic";

export default async function TeacherInsightsPage() {
  const session = await requireRole(["TEACHER"]);
  const classes = await getTeacherClasses(session.user.id);
  const classIds = classes.map((c) => c.class_id);

  const all: { insights: Awaited<ReturnType<typeof listInsights>>; className: string }[] = [];
  for (const c of classes) {
    const insights = await listInsights({ classId: c.class_id, limit: 50 });
    all.push({ insights, className: c.class_name });
  }
  const total = all.reduce((n, x) => n + x.insights.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Alertes & signaux</h1>
        <p className="text-muted-foreground">
          Signaux concernant vos classes ({total} au total).
        </p>
      </div>
      {classIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune classe associée à votre compte enseignant.
        </p>
      ) : (
        <div className="space-y-8">
          {all.map((g) => (
            <div key={g.className} className="space-y-3">
              <h2 className="text-lg font-semibold">{g.className}</h2>
              <InsightsList insights={g.insights} empty="Aucun signal pour cette classe." />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
