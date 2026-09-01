"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approveLinkRequest, rejectLinkRequest } from "@/lib/actions/linking";

export function LinkRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string; ok?: boolean }>, okMsg: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(okMsg);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => run(() => approveLinkRequest(requestId), "Demande approuvée")}
      >
        Approuver
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => run(() => rejectLinkRequest(requestId), "Demande rejetée")}
      >
        Rejeter
      </Button>
    </div>
  );
}