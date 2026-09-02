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

export default async function ParentChildrenPage() {
  const session = await requireRole(["PARENT"]);
  const children = await getParentChildren(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mes enfants</h1>
          <p className="text-muted-foreground">
            {children.length} enfant{children.length > 1 ? "s" : ""} lié{children.length > 1 ? "s" : ""}.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/parent/link">Ajouter un enfant</Link>
        </Button>
      </div>

      {children.length === 0 ? (
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
      )}
    </div>
  );
}