import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSession, roleHome } from "@/lib/auth/session";

const sections = [
  {
    icon: "📋",
    title: "Présences",
    desc: "L'enseignant prend l'appel en quelques gestes. Les parents sont informés en temps réel.",
  },
  {
    icon: "🎓",
    title: "Suivi des notes",
    desc: "Notes, moyennes et coefficients accessibles simplement par les parents.",
  },
  {
    icon: "📢",
    title: "Annonces",
    desc: "La direction communique avec toute l'école ou classe par classe.",
  },
  {
    icon: "🔗",
    title: "Lien parent",
    desc: "Chaque parent reçoit un code pour lier ses enfants et suivre leur scolarité.",
  },
  {
    icon: "📊",
    title: "Analyse",
    desc: "Tableaux de bord et rapports pour piloter votre établissement.",
  },
  {
    icon: "📥",
    title: "Import simple",
    desc: "Importez vos élèves, enseignants et classes par fichier CSV.",
  },
];

export default async function Home() {
  const session = await getSession();
  if (session?.primaryRole) {
    redirect(roleHome(session.primaryRole));
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              E
            </span>
            <span className="text-lg font-bold">EduTrack</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            <Link href="/pricing" className="hover:text-foreground">
              Tarifs
            </Link>
            <Link href="/demo" className="hover:text-foreground">
              Démo
            </Link>
            <Link href="/contact" className="hover:text-foreground">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/login">Se connecter</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Essai gratuit</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col">
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Le lien intelligent entre{" "}
            <span className="text-primary">l&apos;école</span> et la{" "}
            <span className="text-primary">famille</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            EduTrack permet aux établissements scolaires de communiquer avec les
            parents et de leur fournir un suivi quasi temps réel de la scolarité
            de leurs enfants : présences, absences, retards, notes et annonces.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Commencer gratuitement</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">Demander une démo</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            14 jours d&apos;essai gratuit · Sans carte bancaire
          </p>
        </section>

        {/* Fonctionnalités */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <h2 className="text-center text-2xl font-bold">
              Tout ce qu&apos;il faut pour bien communiquer
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sections.map((f) => (
                <Card key={f.title}>
                  <CardContent className="p-6 text-left">
                    <div className="text-2xl">{f.icon}</div>
                    <h3 className="mt-3 font-semibold">{f.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Tarifs */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold">Des formules adaptées à votre école</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Un essai gratuit de 14 jours, puis choisissez entre Starter, Standard
            ou Pro. L&apos;accès parents est gratuit.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href="/pricing">Voir les tarifs</Link>
            </Button>
          </div>
        </section>

        {/* CTA final */}
        <section className="border-t bg-primary/5">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 text-center">
            <h2 className="text-2xl font-bold">
              Prêt à moderniser la communication de votre école ?
            </h2>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup">Créer mon compte gratuit</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/contact">Nous contacter</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <div>ÉduTrack — Service accessible sur smartphone, même en connexion mobile.</div>
          <div className="flex gap-4">
            <Link href="/pricing" className="hover:text-foreground">Tarifs</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
            <Link href="/demo" className="hover:text-foreground">Démo</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
