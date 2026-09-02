import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getParentChildren } from "@/lib/db/parent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const statusLabels: Record<string, string> = {
  active: "Actif",
  inactive: "Inactif",
  graduated: "Diplômé",
  transferred: "Transféré",
};

function initials(first: string, last: string) {
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

export default async function ParentDashboardPage() {
  const session = await requireRole(["PARENT"]);
  const children = await getParentChildren(session.user.id);
  const fullName =
    (session.user.user_metadata?.full_name as string) ||
    session.user.email ||
    "";
  const firstName = String(fullName).split(" ")[0] || "Cher parent";

  const hasAny = children.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bonjour, {firstName}</h1>
        <p className="text-muted-foreground">
          Suivez la scolarité de vos enfants en toute sécurité.
        </p>
      </div>

      {!hasAny ? (
        <Card>
          <CardHeader>
            <CardTitle>Vous n&apos;avez encore aucun enfant lié à votre compte.</CardTitle>
            <CardDescription>
              Saisissez le code de liaison fourni par l&apos;établissement pour
              suivre la scolarité de votre enfant.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/app/parent/link">Ajouter un enfant</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Mes enfants</h2>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/parent/link">Ajouter un enfant</Link>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {children.map((child) => (
              <Card key={child.student_id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {initials(child.student_first_name, child.student_last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{child.student_first_name} {child.student_last_name}</span>
                  </CardTitle>
                  <CardDescription>
                    {child.class_name ?? "Classe non définie"} —{" "}
                    {child.school_name ?? "Établissement"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2">
                  <Badge variant={child.status === "active" ? "default" : "secondary"}>
                    {statusLabels[child.status] ?? child.status}
                  </Badge>
                  <Button asChild size="sm">
                    <Link href={`/app/parent/children/${child.student_id}`}>
                      Voir le suivi
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {hasAny ? (
        <Card>
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
            <CardDescription>
              Suivi de vos enfants et de vos demandes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/app/parent/link-requests"
              className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted"
            >
              <span>Consulter l&apos;état de mes demandes de liaison</span>
              <span className="text-muted-foreground">→</span>
            </Link>
            <Link
              href="/app/parent/children"
              className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted"
            >
              <span>Tous mes enfants</span>
              <span className="text-muted-foreground">→</span>
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}