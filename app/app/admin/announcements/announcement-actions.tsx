"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  deleteAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
} from "@/lib/actions/announcements";

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
    if (!confirm("Supprimer définitivement cette annonce ?")) return;
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

export function AnnouncementPublishButton({
  announcementId,
  schoolId,
}: {
  announcementId: string;
  schoolId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onPublish() {
    if (!confirm("Publier cette annonce ? Les parents concernés seront notifiés.")) return;
    startTransition(async () => {
      const result = await publishAnnouncement(announcementId, schoolId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Annonce publiée");
      router.refresh();
    });
  }

  return (
    <Button variant="default" size="sm" onClick={onPublish} disabled={pending}>
      Publier
    </Button>
  );
}

export function AnnouncementArchiveButton({
  announcementId,
  schoolId,
}: {
  announcementId: string;
  schoolId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onArchive() {
    if (!confirm("Archiver cette annonce ? Elle ne sera plus visible des parents.")) return;
    startTransition(async () => {
      const result = await archiveAnnouncement(announcementId, schoolId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Annonce archivée");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={onArchive} disabled={pending}>
      Archiver
    </Button>
  );
}
