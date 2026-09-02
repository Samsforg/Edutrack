import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { getParentChildDetail } from "@/lib/db/parent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getStudentAttendanceSummary } from "@/lib/db/attendance-history";

const statusLabels: Record<string, string> = {
  active: "Actif",
  inactive: "Inactif",
  graduated: "Diplômé",
  transferred: "Transféré",
};

export default async function ParentChildDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["PARENT"]);
  const child = await getParentChildDetail(id);

  // RLS + notFound: a parent who is not linked to the student gets null.
  if (!child) return notFound();

  const to = new Date().toISOString().slice(0, 10);
  const from90 = new Date();
  from90.setDate(from90.getDate() - 89);
  const from = from90.toISOString().slice(0, 10);
  const summary = await getStudentAttendanceSummary(id, from, to);
  const rangeLabel = "90 derniers jours";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/app/parent/children"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Mes enfants
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            {child.student_first_name} {child.student_last_name}
          </h1>
          <p className="text-muted-foreground">
            {child.school_name ?? "Établissement"} — {child.class_name ?? "Classe non définie"}
          </p>
        </div>
        <Badge variant={child.status === "active" ? "default" : "secondary"}>
          {statusLabels[child.status] ?? child.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profil scolaire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Matricule" value={child.matricule} />
            <Row label="Classe" value={child.class_name ?? "—"} />
            <Row
              label="Année scolaire"
              value={child.academic_year_name ?? "—"}
            />
            <Row
              label="Date de naissance"
              value={
                child.birth_date
                  ? format(new Date(child.birth_date), "dd/MM/yyyy", { locale: fr })
                  : "—"
              }
            />
            <Row
              label="Sexe"
              value={
                child.gender === "M"
                  ? "Masculin"
                  : child.gender === "F"
                    ? "Féminin"
                    : "—"
              }
            />
            <Row
              label="Inscription"
              value={
                child.enrollment_date
                  ? format(new Date(child.enrollment_date), "dd/MM/yyyy", { locale: fr })
                  : "—"
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informations établissement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Établissement" value={child.school_name ?? "—"} />
            <Row label="Téléphone" value={child.school_phone ?? "—"} />
            <Row label="Email" value={child.school_email ?? "—"} />
            <Row
              label="Adresse"
              value={
                [child.school_address, child.school_city].filter(Boolean).join(", ") || "—"
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assiduité ({rangeLabel})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Taux de présence" value={summary.rate == null ? "—" : `${summary.rate}%`} />
            <Stat label="Jours relevés" value={String(summary.total)} />
            <Stat label="Présent" value={String(summary.present)} />
            <Stat label="Retard" value={String(summary.late)} />
            <Stat label="Absent" value={String(summary.absent)} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Basé sur les {summary.total} jour(s) de présence enregistré(s).
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/parent/children/${id}/attendance`}>
                Historique complet →
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/parent/children">← Retour</Link>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}