import { requireRole } from "@/lib/auth/guard";
import { listTeachers } from "@/lib/db/classes";
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
import { TeacherFormButton, TeacherDeleteButton } from "./teacher-actions";

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

  const teachers = await listTeachers(schoolId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Enseignants</h1>
          <p className="text-muted-foreground">{teachers.length} enseignant(s)</p>
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      {t.last_name} {t.first_name}
                    </TableCell>
                    <TableCell className="text-right">
                      <TeacherDeleteButton
                        teacherId={t.id}
                        schoolId={schoolId}
                        name={`${t.last_name} ${t.first_name}`}
                      />
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