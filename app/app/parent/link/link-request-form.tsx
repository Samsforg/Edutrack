"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { verifyStudentLinkCode, createLinkRequest } from "@/lib/actions/linking";
import type { VerifiedLinkCode } from "@/types/student-link";

type ConfirmationItem = {
  label: string;
  value: string;
};

export function LinkRequestForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<VerifiedLinkCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  function stepVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    startTransition(async () => {
      const res = await verifyStudentLinkCode(code);
      setVerifying(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      setVerified(res.data as VerifiedLinkCode);
    });
  }

  function stepCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createLinkRequest(code);
      if (res.error) {
        setError(res.error);
        setVerified(null);
        return;
      }
      toast.success("Demande envoyée. En attente de validation.");
      router.push("/app/parent/link-requests");
      router.refresh();
    });
  }

  function reset() {
    setError(null);
    setVerified(null);
    setCode("");
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle>{verified ? "Confirmer la liaison" : "Se lier à un enfant"}</CardTitle>
        <CardDescription>
          Format du code : EDU-XXXX-XXXX (insensible à la casse).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!verified ? (
          <form onSubmit={stepVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code de liaison</Label>
              <Input
                id="code"
                name="code"
                required
                autoComplete="off"
                placeholder="EDU-XXXX-XXXX"
                className="font-mono uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={verifying || pending}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={verifying || pending}>
              {verifying ? "Vérification…" : "Vérifier le code"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">
                Ce code correspond bien à l&apos;enfant suivant :
              </p>
              <ul className="mt-2 space-y-1">
                <ConfirmationRow label="Enfant" value={`${verified.firstName} ${verified.lastName}`} />
                <ConfirmationRow label="Établissement" value={verified.schoolName} />
              </ul>
              <Badge variant="outline" className="mt-3">
                Valide 7 jours, à usage unique
              </Badge>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} disabled={pending}>
                Modifier le code
              </Button>
              <Button onClick={stepCreate} disabled={pending}>
                {pending ? "Envoi…" : "Confirmer la liaison"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConfirmationRow({ label, value }: ConfirmationItem) {
  return (
    <li className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}