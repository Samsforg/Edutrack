import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { listLinkRequests } from "@/lib/db/link-requests";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkRequestActions } from "./link-request-actions";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Rejetée",
  expired: "Expirée",
};

export default async function LinkRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
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

  const validStatuses = ["pending", "approved", "rejected", "expired"];
  const filter = validStatuses.includes(status ?? "")
    ? (status as "pending" | "approved" | "rejected" | "expired")
    : undefined;

  const requests = await listLinkRequests(schoolId, filter);

  const tabs = [
    { key: undefined, label: "Toutes" },
    { key: "pending", label: "En attente" },
    { key: "approved", label: "Approuvées" },
    { key: "rejected", label: "Rejetées" },
    { key: "expired", label: "Expirées" },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Demandes de liaison</h1>
        <p className="text-muted-foreground">
          Approbation des demandes de liaison parent-enfant.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.key ?? "all"}
            asChild
            variant={filter === t.key ? "default" : "outline"}
            size="sm"
          >
            <Link href={t.key ? `?status=${t.key}` : "/app/admin/link-requests"}>
              {t.label}
            </Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucune demande{filter ? ` ${STATUS_LABELS[filter]?.toLowerCase() ?? ""}` : ""}.
            </div>
          ) : (
            <div className="divide-y">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {r.student_name ?? "Élève inconnu"}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {r.matricule}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Demandé par {r.parent_name ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                      {" — expire "}
                      {formatDistanceToNow(new Date(r.expires_at), { locale: fr, addSuffix: true })}
                    </p>
                    {r.status === "rejected" && r.reason ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Motif : {r.reason}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" || r.status === "expired" ? "destructive" : "secondary"}>
                      {STATUS_LABELS[r.status]}
                    </Badge>
                    {r.status === "pending" ? (
                      <LinkRequestActions requestId={r.id} />
                    ) : null}
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