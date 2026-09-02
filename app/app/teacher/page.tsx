import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getTeacherClasses } from "@/lib/db/teacher";
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
  const called: Record<string, boolean> = {};
  for (const c of classes) {
    called[c.class_id] = await hasClassAttendance(c.class_id, today);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Espace Enseignant</h1>
        <p className="text-muted-foreground">
          Vos classes et vos outils de suivi.
        </p>
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
                  <Link href={`/app/teacher/grades?classId=${c.class_id}`}>
                    Notes
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}