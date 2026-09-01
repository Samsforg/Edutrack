"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { saveAttendance } from "@/lib/actions/attendance";
import type { AttendanceStatus } from "@/types/database";

export type AttendanceStudent = {
  id: string;
  name: string;
  matricule: string;
};

export type ExistingEntry = {
  student_id: string;
  status: AttendanceStatus;
};

const STATUS_META: {
  value: AttendanceStatus;
  label: string;
  short: string;
  activeClass: string;
}[] = [
  {
    value: "present",
    label: "Présent",
    short: "P",
    activeClass: "border-emerald-500 bg-emerald-50 text-emerald-700",
  },
  {
    value: "absent",
    label: "Absent",
    short: "A",
    activeClass: "border-red-500 bg-red-50 text-red-700",
  },
  {
    value: "late",
    label: "Retard",
    short: "R",
    activeClass: "border-amber-500 bg-amber-50 text-amber-700",
  },
  {
    value: "excused",
    label: "Excusé",
    short: "E",
    activeClass: "border-sky-500 bg-sky-50 text-sky-700",
  },
];

type Props = {
  classId: string;
  students: AttendanceStudent[];
  existing: ExistingEntry[];
};

export function AttendanceForm({ classId, students, existing }: Props) {
  const [pending, startTransition] = useTransition();
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(
    () => {
      const initial: Record<string, AttendanceStatus> = {};
      for (const s of students) {
        const found = existing.find((e) => e.student_id === s.id);
        initial[s.id] = found?.status ?? "present";
      }
      return initial;
    }
  );

  const [savedAt, setSavedAt] = useState<Date | null>(
    existing.length > 0 ? new Date() : null
  );

  const submitted =
    existing.length > 0 &&
    Object.keys(statuses).every(
      (id) => existing.find((e) => e.student_id === id)?.status === statuses[id]
    );

  function setAll(status: AttendanceStatus) {
    setStatuses(
      Object.fromEntries(students.map((s) => [s.id, status]))
    );
  }

  function submit() {
    const entries = students.map((s) => ({
      studentId: s.id,
      status: statuses[s.id],
    }));
    startTransition(async () => {
      toast.promise(saveAttendance({ classId, entries }), {
        loading: "Enregistrement…",
        success: (r) => {
          if ("error" in r) throw new Error(r.error);
          setSavedAt(new Date());
          return `Présences enregistrées (${r.saved} élèves).`;
        },
        error: (e: Error) => e.message,
      });
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_META.map((s) => (
              <Button
                key={s.value}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAll(s.value)}
              >
                Tout : {s.label}
              </Button>
            ))}
          </div>
          <Badge variant="outline">
            {students.length} élève{students.length > 1 ? "s" : ""}
          </Badge>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {students.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Aucun élève dans cette classe.
            </CardContent>
          </Card>
        ) : (
          students.map((s) => (
            <Card key={s.id} className="p-0">
              <CardContent className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.matricule}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {STATUS_META.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-label={opt.label}
                      aria-pressed={statuses[s.id] === opt.value}
                      onClick={() => setStatuses((prev) => ({ ...prev, [s.id]: opt.value }))}
                      className={`flex h-10 w-10 items-center justify-center rounded-md border text-sm font-semibold transition ${
                        statuses[s.id] === opt.value
                          ? opt.activeClass
                          : "border-input bg-background text-muted-foreground"
                      }`}
                    >
                      {opt.short}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {savedAt && submitted ? (
        <p className="text-sm text-muted-foreground">
          Appel déjà enregistré aujourd&apos;hui à{" "}
          {savedAt.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          .
        </p>
      ) : null}

      <Button
        onClick={submit}
        disabled={pending || students.length === 0 || submitted}
        size="lg"
        className="w-full"
      >
        {pending
          ? "Enregistrement…"
          : submitted
            ? "Appel déjà validé"
            : "Valider l'appel"}
      </Button>
    </div>
  );
}