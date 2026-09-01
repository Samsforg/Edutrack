import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getAdminStats } from "@/lib/db/admin";
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

  const quickActions = [
    { href: "/app/admin/students", label: "Élèves" },
    { href: "/app/admin/teachers", label: "Enseignants" },
    { href: "/app/admin/classes", label: "Classes" },
    { href: "/app/admin/announcements", label: "Annonces" },
    { href: "/app/admin/link-requests", label: "Codes & demandes" },
    { href: "/app/admin/import", label: "Import CSV" },
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
          { label: "Enseignants", value: stats.teachers },
          { label: "Parents", value: stats.parents },
          { label: "Classes", value: stats.classes },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-3xl font-bold">{s.value}</p>
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