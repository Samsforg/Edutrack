"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import { updateSchool } from "@/lib/actions/school";
import { createAcademicYear } from "@/lib/actions/academic-years";
import { changePlan } from "@/lib/actions/billing";
import type { PlanCode } from "@/lib/billing/plans";

type PlanOption = {
  code: PlanCode;
  name: string;
  priceLabel: string;
  isDefault: boolean;
};

const STEPS = [
  "Établissement",
  "Année scolaire",
  "Plan",
  "Import",
  "Équipe",
  "Terminé",
];

export function OnboardingWizard({
  schoolId,
  initialProfile,
  plans,
}: {
  schoolId: string;
  initialProfile: { name: string; city: string; phone: string; email: string };
  plans: PlanOption[];
}) {
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState(initialProfile);
  const [year, setYear] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });
  const [chosenPlan, setChosenPlan] = useState<PlanCode | null>(null);

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateSchool({ schoolId, ...profile });
      if (res.error) {
        setError(res.error);
        return;
      }
      setStep(1);
    });
  }

  function saveYear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createAcademicYear({ schoolId, ...year });
      if (res.error) {
        setError(res.error);
        return;
      }
      setStep(2);
    });
  }

  function savePlan(code: PlanCode) {
    setError(null);
    startTransition(async () => {
      const res = await changePlan({ planCode: code });
      if (res.ok) {
        setChosenPlan(code);
        setStep(3);
      } else if (res.error) {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bienvenue sur EduTrack</h1>
        <p className="text-muted-foreground">
          Configurons votre établissement en quelques étapes.
        </p>
      </div>

      {/* Progress */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Étape {step + 1} / {STEPS.length}: {STEPS[step]}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {step === 0 && (
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom de l&apos;établissement *</Label>
            <Input
              id="name"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">Ville</Label>
            <Input
              id="city"
              value={profile.city}
              onChange={(e) => setProfile({ ...profile, city: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Enregistrement…" : "Continuer"}
          </Button>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={saveYear} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="year-name">Nom de l&apos;année scolaire *</Label>
            <Input
              id="year-name"
              placeholder="Ex. 2025-2026"
              value={year.name}
              onChange={(e) => setYear({ ...year, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Début</Label>
              <Input
                id="startDate"
                type="date"
                value={year.startDate}
                onChange={(e) => setYear({ ...year, startDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">Fin</Label>
              <Input
                id="endDate"
                type="date"
                value={year.endDate}
                onChange={(e) => setYear({ ...year, endDate: e.target.value })}
                required
              />
            </div>
          </div>
          <Button type="submit" disabled={isPending || !year.name}>
            {isPending ? "Enregistrement…" : "Continuer"}
          </Button>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {plans.map((p) => (
            <Card
              key={p.code}
              className={p.code === "standard" ? "border-primary" : ""}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">
                    {p.name} {p.isDefault && "(populaire)"}
                  </p>
                  <p className="text-sm text-muted-foreground">{p.priceLabel} / an</p>
                </div>
                <Button
                  variant={p.code === "standard" ? "default" : "outline"}
                  disabled={isPending}
                  onClick={() => savePlan(p.code)}
                >
                  {chosenPlan === p.code ? <Check className="h-4 w-4" /> : "Choisir"}
                </Button>
              </CardContent>
            </Card>
          ))}
          <Button variant="ghost" onClick={() => setStep(3)}>
            Plus tard
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p>
            Importez vos élèves, enseignants, parents et classes pour gagner du temps.
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/app/admin/import">Importer maintenant</Link>
            </Button>
            <Button variant="ghost" onClick={() => setStep(4)}>
              Plus tard
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <p>Ajoutez des membres du personnel à votre établissement.</p>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/app/admin/teachers">Gérer les enseignants</Link>
            </Button>
            <Button variant="ghost" onClick={() => setStep(5)}>
              Plus tard
            </Button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-800">
            <strong>Félicitations, votre établissement est prêt !</strong>
          </div>
          <Button asChild size="lg" className="w-full">
            <Link href="/app/admin">Accéder à mon tableau de bord</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
