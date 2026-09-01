import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { getTeacherClasses, getClassStudents } from "@/lib/db/teacher";
import { getTodayAttendance } from "@/lib/db/attendance-today";
import { AttendanceForm } from "./attendance-form";

export default async function AttendancePage({
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
        <h1 className="text-2xl font-bold">Faire l&apos;appel</h1>
        <p className="text-muted-foreground">
          Sélectionnez une classe.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((c) => (
            <a
              key={c.class_id}
              href={`/app/teacher/attendance?classId=${c.class_id}`}
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

  const owned = classes.some((c) => c.class_id === classId);
  if (!owned) {
    // A school admin can also take attendance even if not a "teacher" for the class.
    // For simplicity in the MVP, restrict attendance to assigned teachers unless
    // the user is a school admin, in which case load directly.
    const isAdmin = session.memberships.some(
      (m) => m.role === "SCHOOL_ADMIN" && m.school_id === classes[0]?.school_id
    );
    if (!isAdmin) {
      redirect("/app/teacher");
    }
  }

  const [students, today] = await Promise.all([
    getClassStudents(classId),
    getTodayAttendance(classId),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Appel du jour</h1>
        <p className="text-muted-foreground">
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>
      <AttendanceForm
        classId={classId}
        students={students.map((s) => ({
          id: s.id,
          name: `${s.last_name} ${s.first_name}`,
          matricule: s.matricule,
        }))}
        existing={today}
      />
    </div>
  );
}