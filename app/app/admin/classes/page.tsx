import { requireRole } from "@/lib/auth/guard";
import { listClasses, listTeachers, listSubjects } from "@/lib/db/classes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClassFormButton } from "./class-form";
import { SubjectAssigner } from "./subject-assigner";

export default async function ClassesPage() {
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

  const [classes, allTeachers, allSubjects] = await Promise.all([
    listClasses(schoolId),
    listTeachers(schoolId),
    listSubjects(schoolId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Classes</h1>
          <p className="text-muted-foreground">
            {classes.length} classe(s)
          </p>
        </div>
        <ClassFormButton schoolId={schoolId} />
      </div>

      <div className="space-y-4">
        {classes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Créez votre première classe.
            </CardContent>
          </Card>
        ) : (
          classes.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {c.name}
                  <Badge variant="secondary">{c.student_count} élèves</Badge>
                </CardTitle>
                <CardDescription>
                  {c.grade_level ? `Niveau : ${c.grade_level}` : "Niveau non défini"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {c.subjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune matière assignée.
                  </p>
                ) : (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {c.subjects.map((s) => (
                      <div
                        key={s.subject_id}
                        className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
                      >
                        <span>{s.subject_name}</span>
                        <span className="text-muted-foreground">
                          {s.teacher_name ?? "Aucun enseignant"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <SubjectAssigner
                  classId={c.id}
                  classSubjects={c.subjects.map((s) => ({
                    subject_id: s.subject_id,
                    teacher_id: s.teacher_id,
                  }))}
                  teachers={allTeachers.map((t) => ({
                    id: t.id,
                    label: `${t.last_name} ${t.first_name}`,
                  }))}
                  subjects={allSubjects}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}