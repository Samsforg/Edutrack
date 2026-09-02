"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/lib/actions/notifications";

/**
 * Marks all the parent's notifications as read then refreshes the list.
 */
export function MarkAllReadButton() {
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const res = await markAllNotificationsRead();
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={handle}
    >
      {pending ? "…" : "Tout marquer comme lu"}
    </Button>
  );
}