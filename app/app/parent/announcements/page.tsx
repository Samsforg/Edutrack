import { requireRole } from "@/lib/auth/guard";
import { getParentAnnouncements } from "@/lib/db/academic";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ParentAnnouncementsPage() {
  const session = await requireRole(["PARENT"]);
  const schoolId = session.memberships.find((m) => m.role === "PARENT")?.school_id;

  if (!schoolId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Aucun établissement lié.
        </CardContent>
      </Card>
    );
  }

  const announcements = await getParentAnnouncements(session.user.id, schoolId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Annonces</h1>
        <p className="text-muted-foreground">
          Communications de votre établissement.
        </p>
      </div>

      <div className="space-y-3">
        {announcements.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Aucune annonce pour le moment.
            </CardContent>
          </Card>
        ) : (
          announcements.map((a) => (
            <Card key={a.id} className={a.important ? "border-primary/40" : undefined}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{a.title}</p>
                    {a.important ? <Badge variant="destructive">Important</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.published_at ?? a.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                  {a.body}
                </p>
                {a.classroom_name ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Classe : {a.classroom_name}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Toute l&apos;école</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
