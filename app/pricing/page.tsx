import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { PLAN_LIST, formatPrice, type Plan } from "@/lib/billing/plans";
import { getSession, roleHome } from "@/lib/auth/session";
import { redirect } from "next/navigation";

const featureLabels: { key: string; label: string }[] = [
  { key: "presence", label: "Suivi des présences" },
  { key: "grades", label: "Notes & moyennes" },
  { key: "announcements", label: "Annonces école / classe" },
  { key: "notifications", label: "Notifications parents" },
  { key: "parent_portal", label: "Portail parents" },
  { key: "dashboards", label: "Tableaux de bord" },
  { key: "imports", label: "Import des données" },
  { key: "reports_basic", label: "Rapports de base" },
  { key: "analytics_advanced", label: "Analyse avancée" },
  { key: "reports_advanced", label: "Rapports avancés (export)" },
  { key: "exports", label: "Export CSV" },
  { key: "priority_support", label: "Support prioritaire" },
  { key: "extended_history", label: "Historique étendu" },
];

function perFeature(plan: Plan) {
  return featureLabels.map((f) => ({
    label: f.label,
    on: plan.features[f.key as keyof typeof plan.features] === true,
  }));
}

export default async function PricingPage() {
  const session = await getSession();
  if (session?.primaryRole) {
    redirect(roleHome(session.primaryRole));
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              E
            </span>
            <span className="text-lg font-bold">EduTrack</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">Se connecter</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Essai gratuit</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Un tarif simple, sans surprise
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            14 jours d&apos;essai gratuit sur le plan Starter. Choisissez ensuite
            le plan qui correspond à la taille de votre établissement.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLAN_LIST.map((plan) => {
            const features = perFeature(plan);
            return (
              <Card
                key={plan.code}
                className={plan.isDefault ? "border-primary ring-2 ring-primary/30" : ""}
              >
                <CardHeader>
                  {plan.isDefault && (
                    <Badge className="w-fit mb-2">Le plus populaire</Badge>
                  )}
                  <CardTitle>{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-3xl font-bold">
                      {formatPrice(plan.price)}
                    </span>
                    <span className="text-sm text-muted-foreground"> / an</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {plan.maxStudents} élèves · {plan.maxTeachers} enseignants ·{" "}
                    {plan.maxAdmins} admin(s)
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2">
                    {features.map((f) => (
                      <li key={f.label} className="flex items-center gap-2 text-sm">
                        {f.on ? (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <span className="h-4 w-4 shrink-0 text-muted-foreground/40">
                            –
                          </span>
                        )}
                        <span className={f.on ? "" : "text-muted-foreground/60"}>
                          {f.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full" variant={plan.isDefault ? "default" : "outline"}>
                    <Link href="/signup">Commencer l&apos;essai</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Parents : l&apos;accès au portail est <strong>gratuit</strong>.{" "}
          <Button asChild variant="link" className="p-0">
            <Link href="/contact">Une question ? Contactez-nous</Link>
          </Button>
        </p>
      </main>

      <footer className="border-t py-6">
        <div className="mx-auto w-full max-w-6xl px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} ÉduTrack
        </div>
      </footer>
    </div>
  );
}
