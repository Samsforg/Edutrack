"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { submitLinkRequest } from "@/lib/actions/linking";

type State = { error?: string; ok?: boolean };

export function LinkRequestForm({ schoolId }: { schoolId: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const code = String(formData.get("code") ?? "");
      const result = await submitLinkRequest(schoolId, code);
      if ("error" in result && result.error) {
        return { error: result.error };
      }
      toast.success("Demande envoyée. En attente de validation.");
      return { ok: true };
    },
    {}
  );

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle>Se lier à un enfant</CardTitle>
        <CardDescription>
          Format du code : EDU-XXXX-XX (insensible à la casse).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Code de liaison</Label>
            <Input
              id="code"
              name="code"
              required
              autoComplete="off"
              placeholder="EDU-XXXX-XX"
              className="font-mono uppercase"
              disabled={pending}
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          {state.ok ? (
            <p className="text-sm text-emerald-600">
              Votre demande a bien été enregistrée.
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Envoi…" : "Envoyer la demande"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}