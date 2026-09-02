import { requireRole } from "@/lib/auth/guard";
import {
  getAttendanceTrend,
  getClassAttendanceRates,
  getSubjectAverages,
  getClassAverages,
  getSchoolKpis,
} from "@/lib/db/analytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExportButtons } from "./export-buttons";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; from?: string; to?: string }>;
}) {
  const session = await requireRole(["SCHOOL_ADMIN"]);
  const schoolId =
    session.memberships.find((m) => m.role === "SCHOOL_ADMIN")?.school_id ?? "";
  const { class: classFilter, from, to } = await searchParams;

  const [kpis, trend, classRates, subjects, classAverages] = await Promise.all([
    getSchoolKpis(schoolId),
    getAttendanceTrend(schoolId, 30),
    getClassAttendanceRates(schoolId, 30),
    getSubjectAverages(schoolId),
    getClassAverages(schoolId),
  ]);

  const maxDaily = Math.max(1, ...trend.map((t) => t.absent + t.late + t.excused + t.present));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rapports</h1>
        <p className="text-muted-foreground">
          Rapports d&apos;assiduité, académiques et statistiques. Exports CSV
          générés côté serveur.
        </p>
      </div>

      {/* Export toolbar */}
      <ExportButtons
        schoolId={schoolId}
        selectedClass={classFilter ?? ""}
        from={from ?? ""}
        to={to ?? ""}
      />

      {/* Attendance report */}
      <Card>
        <CardHeader>
          <CardTitle>Rapport d&apos;assiduité (30 jours)</CardTitle>
          <CardDescription>
            Présences / absences / retards / absences justifiées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Taux de présence" value={`${kpis.attendance_rate ?? "—"}%`} />
            <Kpi label="Absences" value={String(kpis.absences)} />
            <Kpi label="Retards" value={String(kpis.lates)} />
            <Kpi label="Présences (30j)" value={String(kpis.student_count)} />
          </div>

          <div className="mt-4 flex h-32 items-end gap-1">
            {trend.map((t) => {
              return (
                <div key={t.date} className="flex flex-1 flex-col-reverse overflow-hidden rounded-sm"
                  title={`${t.date} — ${t.present} présents, ${t.absent} absents, ${t.late} retards, ${t.excused} excusés`}>
                  <div className="w-full bg-emerald-500" style={{ height: `${(t.present / maxDaily) * 100}%` }} />
                  <div className="w-full bg-amber-500" style={{ height: `${(t.late / maxDaily) * 100}%` }} />
                  <div className="w-full bg-sky-500" style={{ height: `${(t.excused / maxDaily) * 100}%` }} />
                  <div className="w-full bg-destructive/80" style={{ height: `${(t.absent / maxDaily) * 100}%` }} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Academic report */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rapport académique — par matière</CardTitle>
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
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={s.average >= 50 ? "h-full rounded-full bg-emerald-500" : "h-full rounded-full bg-destructive/80"}
                      style={{ width: `${s.average}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rapport académique — par classe</CardTitle>
            <CardDescription>Effectif, présence, moyenne générale.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {classAverages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée.</p>
            ) : (
              classAverages.map((c) => (
                <div key={c.classId}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{c.className}</span>
                    <span className="text-muted-foreground">
                      {c.average} / 100
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={c.average >= 50 ? "h-full rounded-full bg-emerald-500" : "h-full rounded-full bg-destructive/80"}
                      style={{ width: `${c.average}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-class attendance */}
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
                      c.rate >= 80 ? "h-full rounded-full bg-emerald-500"
                        : c.rate >= 60 ? "h-full rounded-full bg-amber-500"
                        : "h-full rounded-full bg-destructive/80"
                    }
                    style={{ width: `${c.rate}%` }}
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
