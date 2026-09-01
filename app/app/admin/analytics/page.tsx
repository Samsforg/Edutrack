import { requireRole } from "@/lib/auth/guard";
import {
  getAttendanceTrend,
  getClassAttendanceRates,
  getSubjectAverages,
  getClassAverages,
} from "@/lib/db/analytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AnalyticsPage() {
  const session = await requireRole(["SCHOOL_ADMIN"]);
  const schoolId = session.memberships.find(
    (m) => m.role === "SCHOOL_ADMIN"
  )?.school_id;

  if (!schoolId) {
    return (
      <Card>
        <CardContent className="p-6">Aucun établissement administré.</CardContent>
      </Card>
    );
  }

  const [trend, classRates, subjects, classAverages] = await Promise.all([
    getAttendanceTrend(schoolId, 30),
    getClassAttendanceRates(schoolId, 30),
    getSubjectAverages(schoolId),
    getClassAverages(schoolId),
  ]);

  const maxDaily = Math.max(1, ...trend.map((t) => t.present + t.absent + t.late + t.excused));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analyse</h1>
        <p className="text-muted-foreground">
          Assiduité et résultats sur les 30 derniers jours.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Présences journalières</CardTitle>
          <CardDescription>Évolution des statuts sur 30 jours.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-1">
            {trend.map((t) => {
              const total = t.present + t.absent + t.late + t.excused;
              if (total === 0) {
                return (
                  <div
                    key={t.date}
                    className="h-0.5 flex-1 rounded bg-muted"
                    title={t.date}
                  />
                );
              }
              return (
                <div
                  key={t.date}
                  className="flex flex-1 flex-col-reverse overflow-hidden rounded-sm"
                  title={`${t.date} — ${t.present} présents, ${t.absent} absents, ${t.late} retards, ${t.excused} excusés`}
                >
                  <div
                    className="w-full bg-emerald-500"
                    style={{ height: `${(t.present / maxDaily) * 100}%` }}
                  />
                  <div
                    className="w-full bg-amber-500"
                    style={{ height: `${(t.late / maxDaily) * 100}%` }}
                  />
                  <div
                    className="w-full bg-sky-500"
                    style={{ height: `${(t.excused / maxDaily) * 100}%` }}
                  />
                  <div
                    className="w-full bg-destructive/80"
                    style={{ height: `${(t.absent / maxDaily) * 100}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Présents
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-destructive/80" /> Absents
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Retards
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> Excusés
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assiduité par classe</CardTitle>
            <CardDescription>Taux de présence sur 30 jours.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {classRates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée.</p>
            ) : (
              classRates.map((c) => (
                <div key={c.classId}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{c.className}</span>
                    <span className="text-muted-foreground">
                      {c.rate}% ({c.recorded} relevés)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={
                        "h-full rounded-full " +
                        (c.rate >= 80
                          ? "bg-emerald-500"
                          : c.rate >= 60
                            ? "bg-amber-500"
                            : "bg-destructive/80")
                      }
                      style={{ width: `${c.rate}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Résultats par matière</CardTitle>
            <CardDescription>Moyennes normalisées /100.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune note.</p>
            ) : (
              subjects.map((s) => (
                <div key={s.subjectId}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{s.subjectName}</span>
                    <span>
                      <Badge variant={s.average >= 50 ? "default" : "destructive"}>
                        {s.average} / 100
                      </Badge>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {s.count} note{s.count > 1 ? "s" : ""}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={
                        "h-full rounded-full " +
                        (s.average >= 50 ? "bg-emerald-500" : "bg-destructive/80")
                      }
                      style={{ width: `${s.average}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Moyennes par classe</CardTitle>
          <CardDescription>Résultats des évaluations par classe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {classAverages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune note.</p>
          ) : (
            classAverages.map((c) => (
              <div key={c.classId}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{c.className}</span>
                  <span className="text-muted-foreground">
                    {c.average} / 100 ({c.count} note{c.count > 1 ? "s" : ""})
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={
                      "h-full rounded-full " +
                      (c.average >= 50 ? "bg-emerald-500" : "bg-destructive/80")
                    }
                    style={{ width: `${c.average}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}