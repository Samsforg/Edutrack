import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { getStudentDetail, listStudentLinkCodes } from "@/lib/db/students";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentLinkCodeCard } from "../student-link-code-card";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  getStudentAttendanceSummary,
  getStudentsAttendanceHistory,
} from "@/lib/db/attendance-history";

const ATT_STATUS: Record<string, { label: string; cls: string }> = {
  present: { label: "Présent", cls: "bg-emerald-100 text-emerald-700" },
  absent: { label: "Absent", cls: "bg-red-100 text-red-700" },
  late: { label: "Retard", cls: "bg-amber-100 text-amber-700" },
  excused: { label: "Excusé", cls: "bg-sky-100 text-sky-700" },
};

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

  const to = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(`${to}T00:00:00`);
  fromDate.setDate(fromDate.getDate() - 89);
  const from = fromDate.toISOString().slice(0, 10);
  const [summary, recent] = await Promise.all([
    getStudentAttendanceSummary(id, from, to),
    getStudentsAttendanceHistory([id], from, to),
  ]);

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
          <CardTitle>Présence (90 derniers jours)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Taux" value={summary.rate == null ? "—" : `${summary.rate}%`} />
            <Stat label="Jours relevés" value={String(summary.total)} />
            <Stat label="Présent" value={String(summary.present)} />
            <Stat label="Retard" value={String(summary.late)} />
            <Stat label="Absent + Excusé" value={String(summary.absent + summary.excused)} />
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune présence enregistrée.</p>
          ) : (
            <div className="divide-y">
              {recent.slice(0, 10).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <span className="text-muted-foreground">
                    {format(new Date(`${r.attendance_date}T00:00:00`), "dd/MM/yyyy", {
                      locale: fr,
                    })}
                  </span>
                  <Badge variant="secondary" className={ATT_STATUS[r.status]?.cls}>
                    {ATT_STATUS[r.status]?.label ?? r.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}