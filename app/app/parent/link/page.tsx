import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getParentChildren } from "@/lib/db/parent";
import { getLinkedRequests } from "@/lib/actions/linking";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkRequestForm } from "./link-request-form";

export default async function LinkPage() {
  const session = await requireRole(["PARENT"]);
  const schoolId =
    session.memberships.find((m) => m.role === "PARENT")?.school_id ?? null;
  const [children, requests] = await Promise.all([
    getParentChildren(session.user.id),
    getLinkedRequests(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Liaison parent-enfant</h1>
        <p className="text-muted-foreground">
          Saisissez le code de liaison fourni par l&apos;établissement pour
          suivre la scolarité de votre enfant.
        </p>
      </div>

      {schoolId ? (
        <LinkRequestForm schoolId={schoolId} />
      ) : (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Aucun établissement associé à votre compte. Contactez votre
              école.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Enfants liés</CardTitle>
          <CardDescription>
            Vous suivez la scolarité de ces enfants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun enfant lié.</p>
          ) : (
            children.map((c) => (
              <div
                key={c.student_id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">
                    {c.student_first_name} {c.student_last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.class_name ?? "Classe non définie"} — {c.matricule}
                  </p>
                </div>
                <Badge variant="outline">Lié</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demandes de liaison</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune demande récente.
            </p>
          ) : (
            requests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{r.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.students
                      ? `${r.students.first_name} ${r.students.last_name}`
                      : "Enfant à confirmer"}{" "}
                    — {new Date(r.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <Badge variant="secondary">{r.status}</Badge>
              </div>
            ))
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