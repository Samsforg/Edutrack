import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { listStudents, listClassesOptions } from "@/lib/db/students";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StudentDeleteButton, StudentFormButton } from "./student-actions";

const PAGE_SIZE = 50;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; classId?: string }>;
}) {
  const { page: pageParam, classId } = await searchParams;
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

  const page = Math.max(Number(pageParam ?? "0") || 0, 0);
  const classes = await listClassesOptions(schoolId);
  const { items, total } = await listStudents(schoolId, {
    page,
    classroomId: classId || undefined,
  });

  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Élèves</h1>
          <p className="text-muted-foreground">{total} élève(s)</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/app/admin/import">Import CSV</Link>
          </Button>
          <StudentFormButton schoolId={schoolId} classes={classes} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          asChild
          variant={classId ? "outline" : "default"}
          size="sm"
        >
          <Link href="/app/admin/students">Toutes</Link>
        </Button>
        {classes.map((c) => (
          <Button
            key={c.id}
            asChild
            variant={classId === c.id ? "default" : "outline"}
            size="sm"
          >
            <Link href={`/app/admin/students?classId=${c.id}`}>{c.name}</Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucun élève. Commencez par en créer un.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.last_name} {s.first_name}
                    </TableCell>
                    <TableCell>{s.matricule}</TableCell>
                    <TableCell>{s.class_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {s.link_code ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <StudentDeleteButton
                        studentId={s.id}
                        schoolId={schoolId}
                        name={`${s.last_name} ${s.first_name}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pages > 1 ? (
        <div className="flex items-center justify-between">
          {page === 0 ? (
            <span />
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/app/admin/students?page=${page - 1}${classId ? `&classId=${classId}` : ""}`}
              >
                Précédent
              </Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page + 1} / {pages}
          </span>
          {page + 1 >= pages ? (
            <span />
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/app/admin/students?page=${page + 1}${classId ? `&classId=${classId}` : ""}`}
              >
                Suivant
              </Link>
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}