import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { getParentChildDetail } from "@/lib/db/parent";
import { getStudentAttendanceSummary } from "@/lib/db/attendance-history";
import { getStudentsAttendanceHistory } from "@/lib/db/attendance-history";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_META: Record<
  string,
  { label: string; cls: string }
> = {
  present: { label: "Présent", cls: "bg-emerald-100 text-emerald-700" },
  absent: { label: "Absent", cls: "bg-red-100 text-red-700" },
  late: { label: "Retard", cls: "bg-amber-100 text-amber-700" },
  excused: { label: "Excusé", cls: "bg-sky-100 text-sky-700" },
};

const RANGES = [
  { key: "7d", label: "7 jours", days: 6 },
  { key: "30d", label: "30 jours", days: 29 },
  { key: "all", label: "Toute l'année", days: null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default async function ParentChildAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const rangeKey: RangeKey = RANGES.some(
    (r) => r.key === sp.range
  )
    ? (sp.range as RangeKey)
    : "30d";
  const range = RANGES.find((r) => r.key === rangeKey)!;

  await requireRole(["PARENT"]);
  const child = await getParentChildDetail(id);
  if (!child) return notFound();

  const to = todayISO();
  const from = range.days == null ? "2000-01-01" : daysAgoISO(range.days);
  const summary = await getStudentAttendanceSummary(id, from, to);
  const history = await getStudentsAttendanceHistory([id], from, to);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/app/parent/children/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {child.student_first_name} {child.student_last_name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Historique de présence</h1>
        <p className="text-muted-foreground">
          {child.student_first_name} {child.student_last_name} —{" "}
          {child.class_name ?? "Classe non définie"}
        </p>
      </div>

      <form className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="submit"
            name="range"
            value={r.key}
            className={`h-9 rounded-md border px-3 text-sm ${
              rangeKey === r.key
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background"
            }`}
          >
            {r.label}
          </button>
        ))}
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Jours relevés" value={String(summary.total)} />
        <Stat label="Présent" value={String(summary.present)} />
        <Stat label="Retard" value={String(summary.late)} />
        <Stat label="Absent" value={String(summary.absent)} />
        <Stat label="Excusé" value={String(summary.excused)} />
      </div>

      {history.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Aucune présence enregistrée sur cette période.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Journal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between gap-3 border-b py-2 last:border-0"
              >
                <span className="text-sm">{formatDate(h.attendance_date)}</span>
                <span className="flex items-center gap-2">
                  {h.note ? (
                    <span className="text-xs text-muted-foreground">{h.note}</span>
                  ) : null}
                  <Badge variant="secondary" className={STATUS_META[h.status]?.cls}>
                    {STATUS_META[h.status]?.label ?? h.status}
                  </Badge>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/parent/children/${id}`}>← Retour</Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}