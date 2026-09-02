"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  generateStudentLinkCode,
  revokeStudentLinkCode,
} from "@/lib/actions/linking";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type LinkCodeEntry = {
  id: string;
  expires_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  used_at: string | null;
  created_at: string;
};

function date(label: string, iso: string) {
  return <div className="text-xs text-muted-foreground">{label} : {format(new Date(iso), "dd/MM/yyyy", { locale: fr })}</div>;
}

export function StudentLinkCodeCard({
  studentId,
  schoolId,
  codes,
}: {
  studentId: string;
  schoolId: string;
  codes: LinkCodeEntry[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const active = codes.find((c) => !c.revoked_at && !c.used_at) ?? null;

  function generate() {
    startTransition(async () => {
      setNewCode(null);
      const res = await generateStudentLinkCode(studentId, schoolId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const data = res.data as { code: string };
      setNewCode(data.code);
      setExpiresAt(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());
      toast.success("Code généré");
    });
  }

  function revoke(code: LinkCodeEntry) {
    if (!confirm("Révoquer ce code de liaison ? Il deviendra immédiatement inutilisable.")) {
      return;
    }
    startTransition(async () => {
      const res = await revokeStudentLinkCode(code.id, schoolId, reason);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Code révoqué");
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-medium">Code de liaison parent</h3>
          {active ? (
            <Badge variant="outline">Actif</Badge>
          ) : (
            <Badge variant="secondary">Aucun actif</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Le code est haché (jamais stocké en clair), valable 7 jours, à usage
          unique. Transmettez-le au parent par un canal hors plateforme.
        </p>
      </div>

      {newCode && expiresAt ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
          <Label className="text-emerald-700 dark:text-emerald-300">
            Code généré — à transmettre immédiatement
          </Label>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded bg-background px-3 py-1.5 text-lg font-mono">
              {newCode}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigator.clipboard.writeText(newCode).then(() => toast.success("Copié"))}
            >
              Copier
            </Button>
          </div>
          {date("Expire le", expiresAt)}
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
            Ce code ne sera affiché qu&apos;une fois. Fermez cette boîte pour
            le masquer.
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setNewCode(null)}>
            Fermer
          </Button>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>{active ? "Régénérer le code" : "Générer un code"}</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{active ? "Régénérer le code" : "Générer un code"}</DialogTitle>
            <DialogDescription>
              {active
                ? "Un nouveau code sera créé et l'ancien révoqué."
                : "Un code de liaison sécurisé sera généré (7 jours, usage unique)."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              onClick={() => {
                setOpen(false);
                generate();
              }}
              disabled={pending}
            >
              {pending ? "Génération…" : "Générer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Codes générés précédemment</h4>
        {codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun code à ce jour.</p>
        ) : (
          codes.map((c) => {
            const isActive = !c.revoked_at && !c.used_at;
            return (
              <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  {date("Généré le", c.created_at)}
                  {date("Expire le", c.expires_at)}
                  <div className="mt-1 flex flex-wrap gap-2">
                    {isActive ? (
                      <Badge variant="outline">Actif</Badge>
                    ) : c.used_at ? (
                      <Badge variant="secondary">Utilisé</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs bg-transparent text-destructive border-destructive/50">
                        Révoqué
                      </Badge>
                    )}
                    {c.used_at ? (
                      <span className="text-xs text-muted-foreground">
                        Consommé le {format(new Date(c.used_at), "dd/MM/yyyy", { locale: fr })}
                      </span>
                    ) : null}
                  </div>
                  {c.revoke_reason ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Motif : {c.revoke_reason}
                    </p>
                  ) : null}
                </div>
                {isActive ? (
                  <div className="flex flex-col items-end gap-2">
                    <Input
                      placeholder="Motif (optionnel)"
                      className="h-8 w-40 text-xs"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <Button variant="destructive" size="sm" disabled={pending} onClick={() => revoke(c)}>
                      Révoquer
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}