import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { getTeacherClasses, getClassStudents } from "@/lib/db/teacher";
import { getTodayAttendance } from "@/lib/db/attendance-today";
import { AttendanceForm } from "./attendance-form";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; date?: string }>;
}) {
  const { classId, date } = await searchParams;
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
    const isAdmin = session.memberships.some(
      (m) =>
        m.role === "SCHOOL_ADMIN" &&
        m.school_id === classes[0]?.school_id
    );
    if (!isAdmin) {
      redirect("/app/teacher");
    }
  }

  const [students, existing] = await Promise.all([
    getClassStudents(classId),
    getTodayAttendance(classId, date),
  ]);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {date && date !== todayStr ? "Appel du jour choisi" : "Appel du jour"}
          </h1>
          <p className="text-muted-foreground">
            {new Date(date ?? todayStr).toLocaleDateString("fr-FR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <form className="flex items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Date</span>
            <input
              type="date"
              name="date"
              defaultValue={date ?? todayStr}
              max={todayStr}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            />
          </label>
          <input type="hidden" name="classId" value={classId} />
          <button
            type="submit"
            className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Charger
          </button>
        </form>
      </div>

      <AttendanceForm
        classId={classId}
        students={students.map((s) => ({
          id: s.id,
          name: `${s.last_name} ${s.first_name}`,
          matricule: s.matricule,
        }))}
        existing={existing}
        attendanceDate={date ?? todayStr}
      />
    </div>
  );
}