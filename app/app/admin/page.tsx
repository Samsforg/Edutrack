import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getAdminStats } from "@/lib/db/admin";
import { getSchoolTodayAttendance } from "@/lib/db/attendance-history";
import { getSchoolAverages } from "@/lib/db/academic";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AdminDashboardPage() {
  const session = await requireRole(["SCHOOL_ADMIN"]);
  const schoolId = session.memberships.find(
    (m) => m.role === "SCHOOL_ADMIN"
  )?.school_id;

  if (!schoolId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aucun établissement administré</CardTitle>
          <CardDescription>
            Vous n&apos;êtes administrateur d&apos;aucun établissement.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const stats = await getAdminStats(schoolId);
  const today = new Date().toISOString().slice(0, 10);
  const todayRows = await getSchoolTodayAttendance(schoolId, today);
  const absents = todayRows.filter((r) => r.status === "absent");
  const unmarked = todayRows.filter((r) => r.status == null);
  const schoolAvg = await getSchoolAverages(schoolId);

  const quickActions = [
    { href: "/app/admin/students", label: "Élèves" },
    { href: "/app/admin/teachers", label: "Enseignants" },
    { href: "/app/admin/classes", label: "Classes" },
    { href: "/app/admin/subjects", label: "Matières" },
    { href: "/app/admin/academic-years", label: "Années scolaires" },
    { href: "/app/admin/parents", label: "Parents" },
    { href: "/app/admin/settings", label: "Paramètres" },
    { href: "/app/admin/announcements", label: "Annonces" },
    { href: "/app/admin/link-requests", label: "Codes & demandes" },
    { href: "/app/admin/import", label: "Import CSV" },
    { href: "/app/admin/analytics", label: "Analyse" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Administration</h1>
          <p className="text-muted-foreground">
            Vue d&apos;ensemble de votre établissement.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Élèves", value: stats.students },
          { label: "Élèves actifs", value: stats.activeStudents },
          { label: "Enseignants", value: stats.teachers },
          { label: "Enseignants actifs", value: stats.activeTeachers },
          { label: "Parents", value: stats.parents },
          { label: "Classes", value: stats.classes },
          { label: "Matières", value: stats.subjects },
          {
            label: "Année courante",
            value: stats.currentAcademicYear ?? "—",
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 truncate text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aujourd&apos;hui</CardTitle>
          <CardDescription>Assiduité enregistrée ce jour.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Présents</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {stats.presentToday}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Absents</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {stats.absentToday}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Retards</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">
              {stats.lateToday}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Excusés</p>
            <p className="mt-1 text-2xl font-bold text-sky-600">
              {stats.excusedToday}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performances académiques</CardTitle>
          <CardDescription>
            Moyennes calculées sur les notes publiées.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Moyenne générale</p>
            <p className="mt-1 text-2xl font-bold">
              {schoolAvg.overall_average != null
                ? `${schoolAvg.overall_average.toFixed(2)} / 20`
                : "—"}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Évaluations notées</p>
            <p className="mt-1 text-2xl font-bold">{schoolAvg.total_evals}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Matières évaluées</p>
            <p className="mt-1 text-2xl font-bold">{schoolAvg.total_subjects}</p>
          </div>
        </CardContent>
        {schoolAvg.by_class.length > 0 ? (
          <CardContent className="border-t pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Moyenne par classe</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {schoolAvg.by_class.map((c) => (
                <div key={c.class_id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span className="font-medium">{c.class_name}</span>
                  <span className="text-muted-foreground">
                    {c.average != null ? `${c.average.toFixed(2)} / 20` : "—"}
                    <span className="ml-1 text-xs">({c.eval_count})</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Absents aujourd&apos;hui</CardTitle>
            <CardDescription>
              {absents.length === 0
                ? "Aucun élève absent enregistré aujourd&apos;hui."
                : `${absents.length} élève${absents.length > 1 ? "s" : ""} absent${absents.length > 1 ? "s" : ""}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {absents.length === 0 ? null : (
              <div className="divide-y">
                {absents.slice(0, 10).map((r) => (
                  <div key={r.student_id} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="font-medium">{r.student_name}</span>
                    <span className="text-xs text-muted-foreground">{r.matricule}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Présences non enregistrées</CardTitle>
            <CardDescription>
              {unmarked.length === 0
                ? "Tous les élèves actifs ont été pointés."
                : `${unmarked.length} élève${unmarked.length > 1 ? "s" : ""} encore non pointé${unmarked.length > 1 ? "s" : ""} aujourd&apos;hui.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unmarked.length === 0 ? null : (
              <div className="max-h-56 space-y-1 overflow-auto">
                {unmarked.slice(0, 10).map((r) => (
                  <div key={r.student_id} className="flex items-center justify-between py-1 text-sm">
                    <span className="font-medium">{r.student_name}</span>
                    <Badge variant="outline">Non pointé</Badge>
                  </div>
                ))}
                {unmarked.length > 10 ? (
                  <p className="pt-1 text-xs text-muted-foreground">
                    …et {unmarked.length - 10} autre{unmarked.length - 10 > 1 ? "s" : ""}.
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {quickActions.map((a) => (
          <Button key={a.href} asChild variant="outline" className="h-auto flex-col gap-1 py-4">
            <Link href={a.href}>
              <span className="text-sm font-medium">{a.label}</span>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}