import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { getParentChildDetail } from "@/lib/db/parent";
import { getStudentAverages, getStudentGradesPublished } from "@/lib/db/academic";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ParentGradesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["PARENT"]);

  const child = await getParentChildDetail(id);
  if (!child) notFound();

  const [averages, grades] = await Promise.all([
    getStudentAverages(id),
    getStudentGradesPublished(id),
  ]);

  const formatAvg = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}`);
  const hasData = averages.total_evals > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notes de {child.student_first_name}</h1>
        <p className="text-muted-foreground">
          {child.class_name ?? "Classe inconnue"}
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">Moyenne générale</p>
          {hasData ? (
            <p className="mt-1 text-3xl font-bold">
              {formatAvg(averages.overall_average)}
              <span className="text-lg font-normal text-muted-foreground"> / 20</span>
            </p>
          ) : (
            <p className="mt-1 text-lg text-muted-foreground">
              Pas encore de moyenne disponible
            </p>
          )}
          {hasData ? (
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-lg font-semibold">{averages.subjects.length}</p>
                <p className="text-xs text-muted-foreground">Matières</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-lg font-semibold">{averages.total_evals}</p>
                <p className="text-xs text-muted-foreground">Évaluations</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-lg font-semibold">
                  {averages.latest_grade
                    ? `${averages.latest_grade.score}/${averages.latest_grade.max_score}`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Dernière note</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Moyennes par matière</CardTitle>
        </CardHeader>
        <CardContent>
          {averages.subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune note publiée pour le moment.
            </p>
          ) : (
            <ul className="divide-y">
              {averages.subjects.map((s) => (
                <li key={s.subject_id}>
                  <Link
                    href={`/app/parent/children/${id}/grades/${s.subject_id}`}
                    className="flex items-center justify-between py-3"
                  >
                    <span className="font-medium">{s.subject_name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {s.eval_count} éval.
                      </span>
                      <span className="font-semibold">{formatAvg(s.average)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évaluations</CardTitle>
        </CardHeader>
        <CardContent>
          {grades.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune note publiée pour le moment.
            </p>
          ) : (
            <ul className="space-y-3">
              {grades.map((g) => (
                <li
                  key={g.id}
                  className="rounded-lg border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{g.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.subject_name} · {new Date(g.grade_date).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {g.score}/{g.max_score}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Coefficient {g.coefficient}
                    </p>
                    {g.comment ? (
                      <p className="text-xs italic text-muted-foreground">{g.comment}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Button asChild variant="outline" size="sm">
        <Link href={`/app/parent/children/${id}`}>← Retour à l&apos;enfant</Link>
      </Button>
    </div>
  );
}
