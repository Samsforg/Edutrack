import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { getParentChildDetail } from "@/lib/db/parent";
import { getStudentGradesPublished } from "@/lib/db/academic";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ParentSubjectGradesPage({
  params,
}: {
  params: Promise<{ id: string; subjectId: string }>;
}) {
  const { id, subjectId } = await params;
  await requireRole(["PARENT"]);

  const child = await getParentChildDetail(id);
  if (!child) notFound();

  const grades = (await getStudentGradesPublished(id)).filter(
    (g) => g.subject_id === subjectId
  );

  if (grades.length === 0) notFound();

  const subjectName = grades[0].subject_name;

  // Evolution: chronological, oldest first
  const chronological = [...grades].sort(
    (a, b) => new Date(a.grade_date).getTime() - new Date(b.grade_date).getTime()
  );

  // Subject average (weighted)
  let wSum = 0;
  let cSum = 0;
  for (const g of grades) {
    wSum += (g.score / g.max_score) * 20 * g.coefficient;
    cSum += g.coefficient;
  }
  const average = cSum > 0 ? Math.round((wSum / cSum) * 100) / 100 : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{subjectName}</h1>
        <p className="text-muted-foreground">
          Notes de {child.student_first_name} {child.student_last_name}
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">Moyenne</p>
          {average != null ? (
            <p className="mt-1 text-3xl font-bold">
              {average.toFixed(2)}
              <span className="text-lg font-normal text-muted-foreground"> / 20</span>
            </p>
          ) : (
            <p className="mt-1 text-lg text-muted-foreground">Pas de moyenne</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {grades.length} évaluation{grades.length > 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évaluations</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {grades.map((g) => (
              <li key={g.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{g.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(g.grade_date).toLocaleDateString("fr-FR")}
                      {g.published_at
                        ? ` · publié le ${new Date(g.published_at).toLocaleDateString("fr-FR")}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {g.score}/{g.max_score}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Coefficient {g.coefficient}
                  </span>
                  {g.comment ? (
                    <span className="text-xs italic text-muted-foreground">
                      {g.comment}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {chronological.length >= 2 ? (
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Évolution</p>
              <ul className="space-y-1 text-sm">
                {chronological.map((g) => (
                  <li key={g.id} className="flex items-center justify-between border-b py-1">
                    <span className="text-muted-foreground">
                      {new Date(g.grade_date).toLocaleDateString("fr-FR")}
                    </span>
                    <span className="font-medium">
                      {g.score}/{g.max_score}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/parent/children/${id}/grades`}>← Notes</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/parent/children/${id}`}>← Retour à l&apos;enfant</Link>
        </Button>
      </div>
    </div>
  );
}
