import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getParentLinkRequests } from "@/lib/db/parent-link-requests";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CancelRequestButton } from "./cancel-request-button";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Rejetée",
  expired: "Expirée",
};

export default async function ParentLinkRequestsPage() {
  await requireRole(["PARENT"]);
  const requests = await getParentLinkRequests();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mes demandes de liaison</h1>
        <p className="text-muted-foreground">
          Suivi des demandes envoyées aux établissements.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
          <CardDescription>
            {requests.length} demande{requests.length > 1 ? "s" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune demande pour le moment.
            </p>
          ) : (
            requests.map((r) => {
              const isPending = r.is_expired ? false : r.status === "pending";
              const expired = r.is_expired;
              return (
                <div
                  key={r.id}
                  className="rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {r.student_first_name
                          ? `${r.student_first_name} ${r.student_last_name}`
                          : "Enfant à confirmer"}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {r.school_name ?? "Établissement"}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                        {isPending && !expired
                          ? ` — expire ${formatDistanceToNow(new Date(r.expires_at), { locale: fr, addSuffix: true })}`
                          : ""}
                      </p>
                      {r.reason && r.status === "rejected" ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Motif : {r.reason}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={
                          r.status === "approved"
                            ? "default"
                            : r.status === "pending" && !expired
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {expired ? "Expirée" : STATUS_LABELS[r.status]}
                      </Badge>
                      {isPending && !expired ? (
                        <CancelRequestButton requestId={r.id} />
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/parent">← Retour</Link>
        </Button>
      </div>
    </div>
  );
}