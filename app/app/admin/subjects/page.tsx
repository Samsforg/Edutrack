import { requireRole } from "@/lib/auth/guard";
import { listSubjectsDetail } from "@/lib/db/subjects";
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
import { SubjectFormButton, SubjectDeleteButton } from "./subject-actions";

export default async function SubjectsPage() {
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

  const subjects = await listSubjectsDetail(schoolId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Matières</h1>
          <p className="text-muted-foreground">
            {subjects.length} matière(s). Le code est unique au sein de
            l’établissement.
          </p>
        </div>
        <SubjectFormButton schoolId={schoolId} />
      </div>

      <Card>
        <CardContent className="p-0">
          {subjects.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucune matière. Créez votre première matière.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Classes affectées</TableHead>
                  <TableHead>Enseignants</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{s.code ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>{s.class_count}</TableCell>
                    <TableCell>{s.teacher_count}</TableCell>
                    <TableCell className="text-right">
                      <SubjectDeleteButton
                        subjectId={s.id}
                        schoolId={schoolId}
                        name={s.name}
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