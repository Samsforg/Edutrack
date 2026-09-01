"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteAnnouncement } from "@/lib/actions/announcements";

export function AnnouncementDeleteButton({
  announcementId,
  schoolId,
}: {
  announcementId: string;
  schoolId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm("Supprimer cette annonce ?")) return;
    startTransition(async () => {
      const result = await deleteAnnouncement(announcementId, schoolId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Annonce supprimée");
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onDelete}
      disabled={pending}
      className="text-muted-foreground"
    >
      Supprimer
    </Button>
  );
}