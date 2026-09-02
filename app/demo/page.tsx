"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitLead } from "@/lib/actions/leads";

export default function DemoPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await submitLead({
        name: String(fd.get("name") ?? ""),
        school_name: String(fd.get("school_name") ?? ""),
        email: String(fd.get("email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        city: String(fd.get("city") ?? ""),
        est_students: fd.get("est_students") ? Number(fd.get("est_students")) : undefined,
        message: String(fd.get("message") ?? ""),
        source: "demo",
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      router.push("/demo?sent=1");
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          E
        </span>
        <span className="text-lg font-bold">EduTrack</span>
      </Link>

      <h1 className="mt-8 text-2xl font-bold">Demande de démonstration</h1>
      <p className="mt-2 text-muted-foreground">
        Laissez-nous vous montrer EduTrack en action avec un de nos experts.
      </p>

      {error && (
        <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom complet *</Label>
            <Input id="name" name="name" required placeholder="Votre nom" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="school_name">Établissement *</Label>
            <Input id="school_name" name="school_name" required placeholder="Nom de l'école" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="vous@exemple.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" name="phone" placeholder="+225 …" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="city">Ville</Label>
            <Input id="city" name="city" placeholder="Ville" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="est_students">Nombre d&apos;élèves</Label>
            <Input id="est_students" name="est_students" type="number" min={0} placeholder="300" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="message">Besoin / contexte</Label>
          <Textarea id="message" name="message" rows={4} placeholder="Parlez-nous de votre établissement…" />
        </div>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Envoi…" : "Demander une démo"}
        </Button>
      </form>
    </div>
  );
}
