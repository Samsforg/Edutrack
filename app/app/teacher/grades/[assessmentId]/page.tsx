import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { getGradesForAssessment } from "@/lib/db/academic";
import { Button } from "@/components/ui/button";
import { GradeGrid } from "./grade-grid";

export default async function AssessmentGradesPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  await requireRole(["TEACHER", "SCHOOL_ADMIN"]);

  const data = await getGradesForAssessment(assessmentId);
  if (!data.assessment.id || !data.assessment.class_id) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{data.assessment.title}</h1>
          <p className="text-muted-foreground">
            Saisie des notes — sur {data.assessment.max_score}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/teacher/grades">← Retour</Link>
        </Button>
      </div>

      <GradeGrid
        assessment={data.assessment}
        students={data.students}
        initialGrades={data.grades}
      />
    </div>
  );
}
