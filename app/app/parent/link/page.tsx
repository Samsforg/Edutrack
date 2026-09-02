import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getParentChildren } from "@/lib/db/parent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkRequestForm } from "./link-request-form";

export default async function LinkPage() {
  const session = await requireRole(["PARENT"]);
  const children = await getParentChildren(session.user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Liaison parent-enfant</h1>
        <p className="text-muted-foreground">
          Saisissez le code de liaison fourni par l&apos;établissement pour
          suivre la scolarité de votre enfant.
        </p>
      </div>

      <LinkRequestForm />

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

      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/parent">← Retour</Link>
        </Button>
      </div>
    </div>
  );
}