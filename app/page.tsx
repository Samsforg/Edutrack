import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSession, roleHome } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSession();
  if (session?.primaryRole) {
    redirect(roleHome(session.primaryRole));
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              E
            </span>
            <span className="text-lg font-bold">EduTrack</span>
          </div>
          <Button asChild variant="outline">
            <Link href="/login">Se connecter</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Le lien intelligent entre{" "}
          <span className="text-primary">l&apos;école</span> et la{" "}
          <span className="text-primary">famille</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          EduTrack permet aux établissements scolaires de communiquer avec les
          parents et de leur fournir un suivi quasi temps réel de la scolarité
          de leurs enfants : présences, absences, retards, notes et annonces.
        </p>

        <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              title: "Présences",
              desc: "L'enseignant prend l'appel en quelques gestes, les parents sont informés en temps réel.",
            },
            {
              title: "Suivi des notes",
              desc: "Notes, moyennes et coefficients accessibles simplement par les parents.",
            },
            {
              title: "Annonces",
              desc: "La direction communique avec toute l'école ou classe par classe.",
            },
          ].map((f) => (
            <Card key={f.title}>
              <CardContent className="p-6 text-left">
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button asChild size="lg" className="mt-10">
          <Link href="/login">Commencer</Link>
        </Button>
      </main>

      <footer className="border-t py-6">
        <div className="mx-auto w-full max-w-5xl px-4 text-center text-sm text-muted-foreground">
          ÉduTrack — Service accessible sur smartphone, même en connexion
          mobile.
        </div>
      </footer>
    </div>
  );
}
