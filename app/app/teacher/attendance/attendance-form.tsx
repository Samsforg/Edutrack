"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAttendance } from "@/lib/actions/attendance";
import type { AttendanceStatus } from "@/types/enums";

export type AttendanceStudent = {
  id: string;
  name: string;
  matricule: string;
};

export type ExistingEntry = {
  student_id: string;
  status: AttendanceStatus;
  check_in: string | null;
  check_out: string | null;
  note: string | null;
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

function toTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export type AttendanceFormState = {
  success: boolean | null;
  saved: number;
  message: string;
};

type Props = {
  classId: string;
  students: AttendanceStudent[];
  existing: ExistingEntry[];
  attendanceDate: string;
};

export function AttendanceForm({ classId, students, existing, attendanceDate }: Props) {
  const [pending, startTransition] = useTransition();
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(() => {
    const initial: Record<string, AttendanceStatus> = {};
    for (const s of students) {
      const found = existing.find((e) => e.student_id === s.id);
      initial[s.id] = found?.status ?? "present";
    }
    return initial;
  });
  const [checkIns, setCheckIns] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      existing.map((e) => [e.student_id, toTimeInput(e.check_in)])
    )
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      existing
        .filter((e) => e.note)
        .map((e) => [e.student_id, e.note as string])
    )
  );
  const [report, setReport] = useState<AttendanceFormState | null>(null);

  const unmarked = useMemo(
    () => students.filter((s) => !statuses[s.id]).length,
    [students, statuses]
  );

  const hasSaved = existing.length > 0;

  function setAll(status: AttendanceStatus) {
    setStatuses(Object.fromEntries(students.map((s) => [s.id, status])));
    setReport(null);
  }

  function mark(studentId: string, status: AttendanceStatus) {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
    setReport(null);
  }

  function setCheckIn(studentId: string, time: string) {
    setCheckIns((prev) => ({ ...prev, [studentId]: time }));
  }

  function setNote(studentId: string, note: string) {
    setNotes((prev) => ({ ...prev, [studentId]: note }));
  }

  function submit() {
    const entries = students
      .filter((s) => statuses[s.id])
      .map((s) => ({ studentId: s.id, status: statuses[s.id] }));

    // Do not silently save an incomplete call.
    if (entries.length !== students.length) {
      const confirmSave = window.confirm(
        `${unmarked} élève${unmarked > 1 ? "s" : ""} non renseigné${
          unmarked > 1 ? "s" : ""
        }. Enregistrer quand même ?`
      );
      if (!confirmSave) return;
    }

    const checkInISO: Record<string, string> = {};
    for (const s of students) {
      const t = checkIns[s.id];
      if (t) checkInISO[s.id] = new Date(`${attendanceDate}T${t}:00`).toISOString();
    }

    startTransition(async () => {
      const res = await saveAttendance({
        classId,
        date: attendanceDate,
        entries,
        checkIns: Object.keys(checkInISO).length ? checkInISO : undefined,
        notes: Object.keys(notes).length ? notes : undefined,
      });
      if ("error" in res) {
        // Never show a false success when the server did not confirm.
        setReport({
          success: false,
          saved: 0,
          message:
            "L'appel n'a pas été enregistré. Vérifiez votre connexion et réessayez.",
        });
        toast.error(res.error);
        return;
      }
      setReport({ success: true, saved: res.saved, message: "" });
      toast.success(`Appel enregistré (${res.saved} élèves).`);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <span className="mr-1 text-sm">Tout :</span>
          {STATUS_META.map((s) => (
            <Button
              key={s.value}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAll(s.value)}
            >
              {s.label}
            </Button>
          ))}
          <Badge variant="outline" className="ml-auto">
            {students.length} élève{students.length > 1 ? "s" : ""}
          </Badge>
        </CardContent>
      </Card>

      {students.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Aucun élève dans cette classe.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {students.map((s) => {
            const late = statuses[s.id] === "late";
            return (
              <Card key={s.id} className="p-0">
                <CardContent className="space-y-3 p-3">
                  <div className="flex items-center justify-between gap-2">
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
                          onClick={() => mark(s.id, opt.value)}
                          className={`flex h-11 w-11 items-center justify-center rounded-md border text-sm font-semibold transition ${
                            statuses[s.id] === opt.value
                              ? opt.activeClass
                              : "border-input bg-background text-muted-foreground"
                          }`}
                        >
                          {opt.short}
                        </button>
                      ))}
                    </div>
                  </div>

                  {late || (statuses[s.id] && statuses[s.id] !== "present") ? (
                    <div className="flex flex-wrap items-end gap-2">
                      {late ? (
                        <div className="space-y-1">
                          <Label htmlFor={`checkin-${s.id}`} className="text-xs">
                            Heure d&apos;arrivée (retard)
                          </Label>
                          <Input
                            id={`checkin-${s.id}`}
                            type="time"
                            value={checkIns[s.id] ?? ""}
                            onChange={(e) => setCheckIn(s.id, e.target.value)}
                            className="h-9 w-32"
                          />
                        </div>
                      ) : null}
                      <div className="min-w-[180px] flex-1 space-y-1">
                        <Label htmlFor={`note-${s.id}`} className="text-xs">
                          Note facultative
                        </Label>
                        <Input
                          id={`note-${s.id}`}
                          value={notes[s.id] ?? ""}
                          maxLength={255}
                          placeholder="Ex. Malade, transport…"
                          onChange={(e) => setNote(s.id, e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!hasSaved && unmarked > 0 && students.length > 0 ? (
        <p className="text-sm text-amber-600">
          {unmarked} élève{unmarked > 1 ? "s" : ""} non renseigné
          {unmarked > 1 ? "s" : ""}.
        </p>
      ) : null}

      {report ? (
        report.success ? null : (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            role="alert"
          >
            L&apos;appel n&apos;a pas été enregistré. Vérifiez votre connexion et
            réessayez.
          </div>
        )
      ) : null}

      <Button
        onClick={submit}
        disabled={pending || students.length === 0 || (hasSaved && unmarked === 0)}
        size="lg"
        className="w-full"
      >
        {pending
          ? "Enregistrement…"
          : hasSaved && unmarked === 0
            ? "Mettre à jour l'appel"
            : "Enregistrer l'appel"}
      </Button>
    </div>
  );
}