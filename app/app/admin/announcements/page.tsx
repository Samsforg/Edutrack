import { requireRole } from "@/lib/auth/guard";
import { listClassesOptions } from "@/lib/db/students";
import { getAdminAnnouncements } from "@/lib/db/academic";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnnouncementForm } from "./announcement-form";
import {
  AnnouncementDeleteButton,
  AnnouncementPublishButton,
  AnnouncementArchiveButton,
} from "./announcement-actions";

export default async function AnnouncementsPage() {
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

  const [classes, announcements] = await Promise.all([
    listClassesOptions(schoolId),
    getAdminAnnouncements(schoolId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Annonces</h1>
          <p className="text-muted-foreground">
            Communiquez avec toute l&apos;école ou une classe.
          </p>
        </div>
        <AnnouncementForm schoolId={schoolId} classes={classes} />
      </div>

      <div className="space-y-3">
        {announcements.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Aucune annonce.
            </CardContent>
          </Card>
        ) : (
          announcements.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{a.title}</CardTitle>
                  {a.important ? (
                    <Badge variant="destructive">Important</Badge>
                  ) : null}
                  <Badge variant="secondary">
                    {a.audience === "class" ? "Classe" : "Tous"}
                  </Badge>
                  {a.published_at ? (
                    <Badge variant="default">Publiée</Badge>
                  ) : (
                    <Badge variant="outline">Brouillon</Badge>
                  )}
                  {a.archived_at ? (
                    <Badge variant="secondary">Archivée</Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  {!a.archived_at ? (
                    a.published_at ? (
                      <AnnouncementArchiveButton
                        announcementId={a.id}
                        schoolId={schoolId}
                      />
                    ) : (
                      <AnnouncementPublishButton
                        announcementId={a.id}
                        schoolId={schoolId}
                      />
                    )
                  ) : null}
                  <AnnouncementDeleteButton
                    announcementId={a.id}
                    schoolId={schoolId}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{a.body}</p>
                {a.classroom_name ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Classe : {a.classroom_name}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
