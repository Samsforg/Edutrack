import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";

export default async function WelcomePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg space-y-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Bienvenue sur EduTrack</h1>
        <p className="mt-1 text-muted-foreground">
          Votre compte est créé : {session.user.email}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prochaine étape</CardTitle>
          <CardDescription>
            Votre compte doit être associé à un établissement avant de pouvoir
            utiliser l&apos;application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Enseignant</strong> — votre établissement vous invite à
            rejoindre EduTrack&nbsp;; l&apos;administrateur crée votre compte
            avec votre email.
          </p>
          <p>
            <strong>Parent</strong> — utilisez le code de liaison reçu de
            l&apos;école (format <code>EDU-XXXX-XX</code>) une fois votre compte
            créé par l&apos;établissement.
          </p>
        </CardContent>
      </Card>

      <form
        action={async () => {
          "use server";
          await logout();
        }}
      >
        <Button type="submit" variant="outline" className="w-full">
          Se déconnecter
        </Button>
      </form>
    </div>
  );
}