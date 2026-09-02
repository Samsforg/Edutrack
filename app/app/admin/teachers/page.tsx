import { requireRole } from "@/lib/auth/guard";
import { listTeachersDetail } from "@/lib/db/teachers";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TeacherFormButton, TeacherDeleteButton, TeacherToggleButton } from "./teacher-actions";

export default async function TeachersPage() {
  const session = await requireRole(["SCHOOL_ADMIN"]);
  const schoolId = session.memberships.find(
    (m) => m.role === "SCHOOL_ADMIN"
  )?.school_id;

  if (!schoolId) {
    return (
      <Card>
        <CardContent className="p-6">Aucun établissement.</CardContent>
      </Card>
    );
  }

  const teachers = await listTeachersDetail(schoolId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Enseignants</h1>
          <p className="text-muted-foreground">
            {teachers.length} enseignant(s), {teachers.filter((t) => t.is_active).length} actif(s)
          </p>
        </div>
        <TeacherFormButton schoolId={schoolId} />
      </div>

      <Card>
        <CardContent className="p-0">
          {teachers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucun enseignant. Créez votre premier enseignant.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>N° employé</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Affectations</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      {t.last_name} {t.first_name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {t.employee_number}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{t.email ?? "—"}</div>
                      <div>{t.phone ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.class_count} classe(s), {t.subject_count} matière(s)
                    </TableCell>
                    <TableCell>
                      {t.is_active ? (
                        <Badge>Actif</Badge>
                      ) : (
                        <Badge variant="secondary">Inactif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <TeacherToggleButton
                          teacher={t}
                          schoolId={schoolId}
                        />
                        <TeacherDeleteButton
                          teacherId={t.id}
                          schoolId={schoolId}
                          name={`${t.last_name} ${t.first_name}`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}