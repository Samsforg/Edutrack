import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getTeacherClasses, getClassStudents, getClassSubjects } from "@/lib/db/teacher";
import { Button } from "@/components/ui/button";
import { GradeForm } from "./grade-form";

export default async function GradesPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const { classId } = await searchParams;
  const session = await requireRole(["TEACHER", "SCHOOL_ADMIN"]);
  const classes = await getTeacherClasses(session.user.id);

  if (!classId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Notes</h1>
        <p className="text-muted-foreground">Sélectionnez une classe.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((c) => (
            <a
              key={c.class_id}
              href={`/app/teacher/grades?classId=${c.class_id}`}
              className="rounded-lg border p-4 hover:bg-muted/50"
            >
              <p className="font-medium">{c.class_name}</p>
              <p className="text-sm text-muted-foreground">
                {c.subjects.map((s) => s.subject_name).join(", ")}
              </p>
            </a>
          ))}
        </div>
      </div>
    );
  }

  const owned = classes.find((c) => c.class_id === classId);
  const schoolId =
    owned?.school_id ??
    session.memberships.find((m) => m.role === "SCHOOL_ADMIN")?.school_id ?? "";

  const [students, subjects] = await Promise.all([
    getClassStudents(classId),
    getClassSubjects(classId),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Ajouter une note</h1>
          <p className="text-muted-foreground">
            {owned?.class_name ?? "Classe"}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/teacher">← Retour</Link>
        </Button>
      </div>

      <GradeForm
        schoolId={schoolId}
        classId={classId}
        students={students.map((s) => ({
          id: s.id,
          label: `${s.last_name} ${s.first_name}`,
        }))}
        subjects={subjects}
      />
    </div>
  );
}