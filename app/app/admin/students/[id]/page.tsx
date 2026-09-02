import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { getStudentDetail, listStudentLinkCodes } from "@/lib/db/students";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentLinkCodeCard } from "../student-link-code-card";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const statusLabels: Record<string, string> = {
  active: "Actif",
  inactive: "Inactif",
  graduated: "Diplômé",
  transferred: "Transféré",
};

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["SCHOOL_ADMIN"]);
  const schoolId = session.memberships.find(
    (m) => m.role === "SCHOOL_ADMIN"
  )?.school_id;

  if (!schoolId) return notFound();

  const [student, codes] = await Promise.all([
    getStudentDetail(schoolId, id),
    listStudentLinkCodes(id),
  ]);

  if (!student) return notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/app/admin/students"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Élèves
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            {student.last_name} {student.first_name}
          </h1>
          <p className="text-muted-foreground">
            {student.school.name} — Matricule {student.matricule}
          </p>
        </div>
        <Badge>{statusLabels[student.status] ?? student.status}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profil scolaire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Matricule</span>
              <span className="font-medium">{student.matricule}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Classe</span>
              <span className="font-medium">{student.class_name ?? "—"}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Année scolaire</span>
              <span className="font-medium">{student.class_school_year ?? "—"}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Date de naissance</span>
              <span className="font-medium">
                {student.birth_date
                  ? format(new Date(student.birth_date), "dd/MM/yyyy", { locale: fr })
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Sexe</span>
              <span className="font-medium">
                {student.gender === "M" ? "Masculin" : student.gender === "F" ? "Féminin" : "—"}
              </span>
            </div>
            <div className="flex justify-between pb-2">
              <span className="text-muted-foreground">Date d&apos;inscription</span>
              <span className="font-medium">
                {format(new Date(student.enrollment_date), "dd/MM/yyyy", { locale: fr })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informations établissement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Établissement</span>
              <span className="font-medium">{student.school.name}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Téléphone</span>
              <span className="font-medium">{student.school.phone ?? "—"}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{student.school.email ?? "—"}</span>
            </div>
            <div className="flex justify-between pb-2">
              <span className="text-muted-foreground">Adresse</span>
              <span className="font-medium text-right">
                {[student.school.address, student.school.city].filter(Boolean).join(", ") || "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liaison parent</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentLinkCodeCard studentId={student.id} schoolId={schoolId} codes={codes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parents liés</CardTitle>
        </CardHeader>
        <CardContent>
          {student.parents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun parent lié.</p>
          ) : (
            <div className="divide-y">
              {student.parents.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.email ?? p.phone ?? "—"}
                    </p>
                  </div>
                  <Badge variant="secondary">{p.user_id ? "Compte lié" : "Sans compte"}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}