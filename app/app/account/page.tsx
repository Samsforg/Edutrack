import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AccountPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mon compte</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>Informations de connexion.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Nom : </span>
            {session.user.user_metadata?.full_name ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Email : </span>
            {session.user.email}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Établissements</CardTitle>
          <CardDescription>Vos rôles au sein des écoles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {session.memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun établissement associé.
            </p>
          ) : (
            session.memberships.map((m) => (
              <div
                key={`${m.school_id}-${m.role}`}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span className="text-sm">{m.school_name}</span>
                <Badge variant="secondary">{m.role}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}