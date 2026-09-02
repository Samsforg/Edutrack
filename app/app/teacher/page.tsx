import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getTeacherClasses } from "@/lib/db/teacher";
import { getTeacherAssessments } from "@/lib/db/academic";
import { getTeacherId } from "@/lib/db/academic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { hasClassAttendance } from "@/lib/db/attendance-history";

export default async function TeacherDashboardPage() {
  const session = await requireRole(["TEACHER"]);
  const classes = await getTeacherClasses(session.user.id);
  const today = new Date().toISOString().slice(0, 10);

  const schoolId = classes[0]?.school_id ?? "";
  const teacherId = schoolId ? await getTeacherId(session.user.id, schoolId) : null;

  const called: Record<string, boolean> = {};
  for (const c of classes) {
    called[c.class_id] = await hasClassAttendance(c.class_id, today);
  }

  const assessments = teacherId
    ? await getTeacherAssessments(session.user.id)
    : [];
  const drafts = assessments.filter((a) => !a.published);
  const published = assessments.filter((a) => a.published);
  const recentAssessments = assessments.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Espace Enseignant</h1>
        <p className="text-muted-foreground">
          Vos classes et vos outils de suivi.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-3xl font-bold">{classes.length}</p>
            <p className="text-sm text-muted-foreground">Mes classes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-3xl font-bold">{drafts.length}</p>
            <p className="text-sm text-muted-foreground">Évaluations en brouillon</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-3xl font-bold">{published.length}</p>
            <p className="text-sm text-muted-foreground">Notes publiées</p>
          </CardContent>
        </Card>
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucune classe assignée</CardTitle>
            <CardDescription>
              Contactez l&apos;administration de votre établissement pour être
              affecté à des classes.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((c) => (
            <Card key={c.class_id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{c.class_name}</CardTitle>
                  <Badge variant={called[c.class_id] ? "default" : "outline"}>
                    {called[c.class_id] ? "Appel effectué" : "Appel à faire"}
                  </Badge>
                </div>
                <CardDescription>
                  {c.subjects.map((s) => s.subject_name).join(", ")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button asChild size="sm" className="flex-1">
                  <Link href={`/app/teacher/attendance?classId=${c.class_id}`}>
                    Faire l&apos;appel
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <Link href={`/app/teacher/grades?class=${c.class_id}`}>
                    Saisir les notes
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Évaluations récentes</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/app/teacher/grades">Toutes</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentAssessments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune évaluation créée pour l&apos;instant.
            </p>
          ) : (
            <ul className="divide-y">
              {recentAssessments.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.class_name} · {a.subject_name} · coefficient {a.coefficient}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.published ? "default" : "outline"}>
                      {a.published ? "Publiée" : "Brouillon"}
                    </Badge>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/app/teacher/grades/${a.id}`}>Saisir</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
