import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getParentChildren } from "@/lib/db/parent";
import { getStudentsAttendance } from "@/lib/db/attendance";
import { getStudentsGrades } from "@/lib/db/grades";
import { getVisibleAnnouncements } from "@/lib/db/announcements";
import { getNotifications, getUnreadCount } from "@/lib/db/notifications";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AttendanceLive } from "@/components/live/attendance-live";

export default async function ParentDashboardPage() {
  const session = await requireRole(["PARENT"]);
  const children = await getParentChildren(session.user.id);

  const studentIds = children.map((c) => c.student_id);
  const schoolId =
    session.memberships.find((m) => m.role === "PARENT")?.school_id ?? "";

  const [attendance, grades, announcements, notifications, unread] =
    await Promise.all([
      getStudentsAttendance(studentIds),
      getStudentsGrades(studentIds),
      getVisibleAnnouncements(schoolId),
      getNotifications(session.user.id),
      getUnreadCount(session.user.id),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Espace Parent</h1>
          <p className="text-muted-foreground">
            Suivi de la scolarité de vos enfants.
          </p>
        </div>
        {schoolId ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/app/parent/link">Lier un enfant</Link>
          </Button>
        ) : null}
      </div>

      {children.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucun enfant lié</CardTitle>
            <CardDescription>
              Utilisez un code de liaison généré par l&apos;établissement pour
              suivre la scolarité de votre enfant.
            </CardDescription>
          </CardHeader>
          {schoolId ? (
            <CardContent>
              <Button asChild>
                <Link href="/app/parent/link">
                  Saisir un code de liaison
                </Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <div className="grid gap-6">
          {children.map((child) => {
            const childAttendance = attendance.filter(
              (a) => a.student_id === child.student_id
            );
            const childGrades = grades.filter(
              (g) => g.student_id === child.student_id
            );

            const scoreFields = childGrades.map((g) => ({
              score: g.score,
              max: g.max_score,
              coef: g.coefficient,
            }));
            const totalCoef = scoreFields.reduce((s, g) => s + g.coef, 0);
            const weighted =
              totalCoef > 0
                ? scoreFields.reduce(
                    (s, g) => s + (g.score / g.max) * g.coef,
                    0
                  ) / totalCoef
                : 0;
            const average = totalCoef > 0 ? Math.round(weighted * 100) : null;

            return (
              <Card key={child.student_id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {child.student_first_name} {child.student_last_name}
                    <Badge variant="secondary">{child.class_name}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Matricule : {child.matricule}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <AttendanceLive
                      studentId={child.student_id}
                      studentName={`${child.student_first_name} ${child.student_last_name}`}
                    />
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Moyenne</p>
                      <p className="mt-1 text-lg font-semibold">
                        {average !== null ? `${average} / 100` : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Absences</p>
                      <p className="mt-1 text-lg font-semibold">
                        {childAttendance.filter(
                          (a) => a.status === "absent"
                        ).length || "0"}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Retards</p>
                      <p className="mt-1 text-lg font-semibold">
                        {childAttendance.filter((a) => a.status === "late")
                          .length || "0"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Annonces</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune annonce récente.
              </p>
            ) : (
              announcements.map((a) => (
                <div key={a.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium">{a.title}</h3>
                    {a.important ? (
                      <Badge variant="destructive">Important</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {unread > 0 ? (
              <Badge>{unread} non lue{unread > 1 ? "s" : ""}</Badge>
            ) : null}
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune notification.
              </p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {n.body}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}