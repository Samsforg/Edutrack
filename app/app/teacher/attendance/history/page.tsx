import { requireRole } from "@/lib/auth/guard";
import { getTeacherClasses } from "@/lib/db/teacher";
import { getTeacherAttendanceHistory } from "@/lib/db/attendance-history";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  present: { label: "Présent", cls: "bg-emerald-100 text-emerald-700" },
  absent: { label: "Absent", cls: "bg-red-100 text-red-700" },
  late: { label: "Retard", cls: "bg-amber-100 text-amber-700" },
  excused: { label: "Excusé", cls: "bg-sky-100 text-sky-700" },
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const session = await requireRole(["TEACHER", "SCHOOL_ADMIN"]);
  const classes = await getTeacherClasses(session.user.id);

  const selectedClassIds = params.classId
    ? [params.classId]
    : classes.map((c) => c.class_id);

  const rows = await getTeacherAttendanceHistory(
    selectedClassIds,
    params.from || null,
    params.to || null
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Historique des appels</h1>
        <p className="text-muted-foreground">
          Consultation de la présence par date et par classe.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <form className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Classe</span>
              <select
                name="classId"
                className="h-9 min-w-40 rounded-md border bg-background px-2 text-sm"
                defaultValue={params.classId ?? ""}
              >
                <option value="">Toutes mes classes</option>
                {classes.map((c) => (
                  <option key={c.class_id} value={c.class_id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Du</span>
              <input
                type="date"
                name="from"
                defaultValue={params.from ?? ""}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Au</span>
              <input
                type="date"
                name="to"
                defaultValue={params.to ?? ""}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Filtrer
            </button>
          </form>
        </CardContent>
      </Card>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Aucune classe affectée.
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Aucun appel enregistré pour ces critères.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Élève</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden sm:table-cell">Arrivée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(`${r.attendance_date}T00:00:00`).toLocaleDateString(
                        "fr-FR"
                      )}
                    </TableCell>
                    <TableCell>{r.student_name}</TableCell>
                    <TableCell>{r.class_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_LABEL[r.status]?.cls}>
                        {STATUS_LABEL[r.status]?.label ?? r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {r.check_in
                        ? new Date(r.check_in).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}