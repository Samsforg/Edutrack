"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AcademicPeriod } from "@/lib/db/academic";
import type { TeacherClass } from "@/lib/db/teacher";
import type { AcademicYearDetail } from "@/lib/db/academic-years";

type Props = {
  schoolId: string;
  years: AcademicYearDetail[];
  currentYearId: string;
  classes: TeacherClass[];
  currentClassId: string;
  currentSubjectId: string;
  periods: AcademicPeriod[];
  currentPeriodId: string;
};

function buildQuery(
  base: Record<string, string>,
  next: Record<string, string>
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...next })) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return `/app/teacher/grades${qs ? `?${qs}` : ""}`;
}

export function SelectorBar({
  schoolId,
  years,
  currentYearId,
  classes,
  currentClassId,
  currentSubjectId,
  periods,
  currentPeriodId,
}: Props) {
  const router = useRouter();
  const selectedClass = classes.find((c) => c.class_id === currentClassId);

  const go = (next: Record<string, string>) =>
    router.push(buildQuery({ year: currentYearId, class: currentClassId, subject: currentSubjectId, period: currentPeriodId }, next));

  return (
    <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-4">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Année scolaire</p>
        <Select
          value={currentYearId}
          onValueChange={(v) => go({ year: v, class: "", subject: "", period: "" })}
        >
          <SelectTrigger><SelectValue placeholder="Année" /></SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.name}{y.is_current ? " (courante)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Classe</p>
        <Select
          value={currentClassId}
          onValueChange={(v) => go({ class: v, subject: "", period: "" })}
        >
          <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.class_id} value={c.class_id}>{c.class_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Matière</p>
        <Select
          value={currentSubjectId}
          onValueChange={(v) => go({ subject: v })}
          disabled={!selectedClass}
        >
          <SelectTrigger><SelectValue placeholder="Matière" /></SelectTrigger>
          <SelectContent>
            {(selectedClass?.subjects ?? []).map((s) => (
              <SelectItem key={s.subject_id} value={s.subject_id}>{s.subject_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Période</p>
        <Select value={currentPeriodId} onValueChange={(v) => go({ period: v })}>
          <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}{p.is_current ? " (courante)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <input type="hidden" value={schoolId} />
    </div>
  );
}
