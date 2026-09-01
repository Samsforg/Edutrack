"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignTeacherToClassSubject } from "@/lib/actions/classes";

type Props = {
  classId: string;
  classSubjects: { subject_id: string; teacher_id: string | null }[];
  teachers: { id: string; label: string }[];
  subjects: { id: string; name: string }[];
};

export function SubjectAssigner({
  classId,
  classSubjects,
  teachers,
  subjects,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(subjectId: string, teacherId: string) {
    startTransition(async () => {
      const result = await assignTeacherToClassSubject(
        classId,
        subjectId,
        teacherId || null
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Affectation mise à jour");
      router.refresh();
    });
  }

  const unassigned = subjects.filter(
    (s) => !classSubjects.some((cs) => cs.subject_id === s.id)
  );

  return (
    <div className="space-y-3">
      {classSubjects.map((cs) => {
        const subject = subjects.find((s) => s.id === cs.subject_id);
        if (!subject) return null;
        return (
          <div key={cs.subject_id} className="flex items-center gap-2">
            <span className="w-40 text-sm font-medium">{subject.name}</span>
            <Select
              value={cs.teacher_id ?? ""}
              onValueChange={(v) => onChange(subject.id, v)}
              disabled={pending}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Aucun enseignant" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}

      {unassigned.length > 0 ? (
        <div className="pt-2 text-sm text-muted-foreground">
          {unassigned.map((s) => s.name).join(", ")} — matières non affectées à
          cette classe.
        </div>
      ) : null}

      {subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune matière définie dans l&apos;établissement.
        </p>
      ) : null}
    </div>
  );
}