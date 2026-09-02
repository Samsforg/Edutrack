import { requireRole } from "@/lib/auth/guard";
import { getPlatformStats, listSchoolsForSuperAdmin } from "@/lib/db/super-admin";
import { getSaasMetrics } from "@/lib/db/saas";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SchoolFormButton } from "./school-form";

export default async function SuperAdminPage() {
  const session = await requireRole(["SUPER_ADMIN"]);
  void session;

  const [stats, schools, saas] = await Promise.all([
    getPlatformStats(),
    listSchoolsForSuperAdmin(),
    getSaasMetrics(),
  ]);

  const cards = [
    { label: "Écoles", value: stats.schools },
    { label: "Écoles actives", value: stats.schoolsActive },
    { label: "Membres", value: stats.members },
    { label: "Enseignants", value: stats.teachers },
    { label: "Parents", value: stats.parents },
    { label: "Élèves", value: stats.students },
  ];

  const saasCards = [
    { label: "MRR", value: `${saas.mrr.toLocaleString("fr-FR")} FCFA` },
    { label: "ARR", value: `${saas.arr.toLocaleString("fr-FR")} FCFA` },
    { label: "Écoles payantes", value: saas.paidSchools },
    { label: "Écoles en essai", value: saas.trialSchools },
    { label: "Conversion essai→payant", value: `${saas.trialConversionRate}%` },
    { label: "Churn", value: `${saas.churnRate}%` },
    { label: "ARPA", value: `${saas.arpa.toLocaleString("fr-FR")} FCFA` },
    { label: "Élèves / école", value: saas.studentsPerSchool },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plateforme</h1>
          <p className="text-muted-foreground">
            Vue d&apos;ensemble de tous les établissements.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/app/super-admin/leads">Leads</Link>
          </Button>
          <SchoolFormButton />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <p className="text-3xl font-bold">{c.value}</p>
              <p className="text-sm text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Métriques SaaS</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {saasCards.map((c) => (
            <div key={c.label} className="rounded-lg border p-3">
              <p className="text-lg font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Établissements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {schools.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucun établissement.
            </div>
          ) : (
            <div className="divide-y">
              {schools.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Code {s.code} — créé le{" "}
                      {new Date(s.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-right">
                    <p className="text-sm text-muted-foreground">
                      {s.admins} admin(s) · {s.students} élève(s)
                    </p>
                    <Badge variant={s.status === "active" ? "default" : "secondary"}>
                      {s.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
