import { requireRole } from "@/lib/auth/guard";
import { listLinkRequests } from "@/lib/db/link-requests";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkRequestActions } from "./link-request-actions";

export default async function LinkRequestsPage() {
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

  const requests = await listLinkRequests(schoolId, true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Demandes de liaison</h1>
        <p className="text-muted-foreground">
          {requests.length} demande(s) en attente
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucune demande en attente.
            </div>
          ) : (
            <div className="divide-y">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {r.student_name ?? "Élève inconnu"}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {r.matricule}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Demandé par {r.parent_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Code {r.code} —{" "}
                      {new Date(r.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">{r.status}</Badge>
                    <LinkRequestActions requestId={r.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}