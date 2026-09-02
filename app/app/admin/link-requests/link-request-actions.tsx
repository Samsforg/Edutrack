"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { approveLinkRequest, rejectLinkRequest } from "@/lib/actions/linking";

export function LinkRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  function approve() {
    startTransition(async () => {
      const result = await approveLinkRequest(requestId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Demande approuvée");
      router.refresh();
    });
  }

  function reject() {
    startTransition(async () => {
      const result = await rejectLinkRequest(requestId, reason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Demande rejetée");
      setReason("");
      setRejectOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" disabled={pending} onClick={approve}>
        Approuver
      </Button>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="destructive" disabled={pending}>
            Rejeter
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeter la demande</DialogTitle>
            <DialogDescription>
              Le parent sera notifié du motif du rejet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Motif (optionnel)</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex : code révoqué, enfant déjà suivi…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={reject} disabled={pending}>
              {pending ? "Rejet…" : "Confirmer le rejet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}