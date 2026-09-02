import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { listStudents, listClassesOptions } from "@/lib/db/students";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StudentDeleteButton, StudentFormButton, StudentStatusSelect } from "./student-actions";
import { STUDENT_STATUSES } from "@/types/enums";

const PAGE_SIZE = 50;

type Params = { page?: string; classId?: string; q?: string; status?: string };

function queryString(params: Params): string {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", params.page);
  if (params.classId) sp.set("classId", params.classId);
  if (params.q) sp.set("q", params.q);
  if (params.status) sp.set("status", params.status);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const { page: pageParam, classId, q, status } = sp;
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
    search: q || undefined,
    status: (status as "active" | "inactive" | "graduated" | "transferred") || undefined,
  });

  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const baseParams: Params = { classId: classId || undefined, q: q || undefined, status: status || undefined };

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

      <form action="/app/admin/students" method="get" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Rechercher (nom, matricule)…"
          className="max-w-xs"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Tous les statuts</option>
          {STUDENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "active" ? "Actif" : s === "inactive" ? "Inactif" : s === "graduated" ? "Diplômé" : "Transféré"}
            </option>
          ))}
        </select>
        {classId ? <input type="hidden" name="classId" value={classId} /> : null}
        <Button type="submit" size="sm" variant="outline">Filtrer</Button>
        {(q || status) ? (
          <Button asChild size="sm" variant="ghost">
            <Link href={queryString({ classId: classId || undefined })}>Effacer</Link>
          </Button>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-2">
        <Button
          asChild
          variant={classId ? "outline" : "default"}
          size="sm"
        >
          <Link href={queryString(baseParams)}>Toutes</Link>
        </Button>
        {classes.map((c) => (
          <Button
            key={c.id}
            asChild
            variant={classId === c.id ? "default" : "outline"}
            size="sm"
          >
            <Link href={queryString({ ...baseParams, classId: c.id })}>{c.name}</Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucun élève ne correspond à ces critères.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Statut</TableHead>
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
                      <StudentStatusSelect
                        student={s}
                        schoolId={schoolId}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/app/admin/students/${s.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          Détails
                        </Link>
                        <StudentDeleteButton
                          studentId={s.id}
                          schoolId={schoolId}
                          name={`${s.last_name} ${s.first_name}`}
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

      {pages > 1 ? (
        <div className="flex items-center justify-between">
          {page === 0 ? (
            <span />
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link
                href={queryString({ ...baseParams, page: String(page - 1) })}
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
                href={queryString({ ...baseParams, page: String(page + 1) })}
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