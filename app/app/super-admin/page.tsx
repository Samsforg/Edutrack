import { requireRole } from "@/lib/auth/guard";
import { getPlatformStats, listSchoolsForSuperAdmin } from "@/lib/db/super-admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SchoolFormButton } from "./school-form";

export default async function SuperAdminPage() {
  const session = await requireRole(["SUPER_ADMIN"]);
  void session;

  const [stats, schools] = await Promise.all([
    getPlatformStats(),
    listSchoolsForSuperAdmin(),
  ]);

  const cards = [
    { label: "Écoles", value: stats.schools },
    { label: "Écoles actives", value: stats.schoolsActive },
    { label: "Membres", value: stats.members },
    { label: "Enseignants", value: stats.teachers },
    { label: "Parents", value: stats.parents },
    { label: "Élèves", value: stats.students },
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
        <SchoolFormButton />
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