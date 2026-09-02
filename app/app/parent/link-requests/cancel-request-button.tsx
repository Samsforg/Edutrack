"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelLinkRequest } from "@/lib/actions/linking";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function cancel() {
    if (!confirm("Annuler cette demande de liaison ?")) return;
    startTransition(async () => {
      const res = await cancelLinkRequest(requestId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Demande annulée");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={cancel}>
      Annuler
    </Button>
  );
}