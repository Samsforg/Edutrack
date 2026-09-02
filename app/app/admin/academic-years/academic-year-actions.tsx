"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setCurrentAcademicYear, deleteAcademicYear } from "@/lib/actions/academic-years";
import type { AcademicYearDetail } from "@/lib/db/academic-years";

export function AcademicYearActions({
  year,
  schoolId,
}: {
  year: AcademicYearDetail;
  schoolId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSetCurrent() {
    if (year.is_current) return;
    startTransition(async () => {
      const result = await setCurrentAcademicYear(year.id, schoolId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Année définie comme courante");
      router.refresh();
    });
  }

  function onDelete() {
    if (!confirm(`Supprimer l'année scolaire ${year.name} ?`)) return;
    startTransition(async () => {
      const result = await deleteAcademicYear(year.id, schoolId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Année scolaire supprimée");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={onSetCurrent}
        disabled={pending || year.is_current}
      >
        {year.is_current ? "Année courante" : "Définir courante"}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={onDelete}
        disabled={pending || year.is_current}
      >
        Supprimer
      </Button>
    </div>
  );
}