import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getTeacherClasses } from "@/lib/db/teacher";
import { listAcademicYears } from "@/lib/db/academic-years";
import { getAcademicPeriods, getAssessmentsForClassSubject, getTeacherId } from "@/lib/db/academic";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SelectorBar } from "./selector-bar";
import { NewAssessmentButton } from "./new-assessment";

export default async function TeacherGradesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const yearId = sp.year ? String(sp.year) : "";
  const classId = sp.class ? String(sp.class) : "";
  const subjectId = sp.subject ? String(sp.subject) : "";
  const periodId = sp.period ? String(sp.period) : "";

  const session = await requireRole(["TEACHER", "SCHOOL_ADMIN"]);
  const classes = await getTeacherClasses(session.user.id);
  const schoolId =
    classes[0]?.school_id ??
    session.memberships.find((m) => m.role === "SCHOOL_ADMIN")?.school_id ??
    "";

  // Teacher's classes (+ their subjects), filtered by selected year if possible.
  const teacherClassMap = new Map(classes.map((c) => [c.class_id, c]));

  // Admin: allow selecting any class in the school.
  const [years, periods, teacherId] = await Promise.all([
    listAcademicYears(schoolId).catch(() => []),
    schoolId ? getAcademicPeriods(schoolId) : [],
    schoolId ? getTeacherId(session.user.id, schoolId) : Promise.resolve(null),
  ]);

  const selectedClass = classId ? teacherClassMap.get(classId) : undefined;
  const selectedSubjects = selectedClass?.subjects ?? [];
  const selectedSubject = selectedSubjects.find((s) => s.subject_id === subjectId);

  const currentPeriod = periods.find((p) => p.is_current);
  const defaultPeriodId =
    periodId ||
    (periods.length === 1 ? periods[0].id : "") ||
    currentPeriod?.id ||
    "";

  const assessments = classId && subjectId
    ? await getAssessmentsForClassSubject(classId, subjectId)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Évaluations & notes</h1>
          <p className="text-muted-foreground">
            Créez une évaluation puis saisissez les notes de la classe.
          </p>
        </div>
        {classId && subjectId && selectedClass && selectedSubject ? (
          <NewAssessmentButton
            schoolId={schoolId}
            classId={classId}
            subjectId={subjectId}
            teacherId={teacherId ?? ""}
            periods={periods}
            defaultPeriodId={defaultPeriodId}
          />
        ) : null}
      </div>

      <SelectorBar
        schoolId={schoolId}
        years={years}
        currentYearId={yearId}
        classes={classes}
        currentClassId={classId}
        currentSubjectId={subjectId}
        periods={periods}
        currentPeriodId={periodId}
      />

      <div className="space-y-3">
        {!classId || !subjectId ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Sélectionnez une classe et une matière.
            </CardContent>
          </Card>
        ) : assessments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Aucune évaluation créée. Créez-en une avec « Nouvelle évaluation ».
            </CardContent>
          </Card>
        ) : (
          assessments.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">{a.title}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Coefficient {a.coefficient}</Badge>
                    <Badge variant="secondary">sur {a.max_score}</Badge>
                    <Badge
                      variant={a.published ? "default" : "outline"}
                    >
                      {a.published ? "Publiée" : "Brouillon"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.assessment_date).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/teacher/grades/${a.id}`}>
                    {a.published ? "Voir" : "Saisir les notes"}
                  </Link>
                </Button>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
