"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveClassGrades, publishGrades } from "@/lib/actions/academic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  assessment: { id: string; title: string; max_score: number; coefficient: number };
  students: { id: string; first_name: string; last_name: string }[];
  initialGrades: { student_id: string; score: number | null; comment: string | null }[];
};

export function GradeGrid({ assessment, students, initialGrades }: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState<
    Record<string, { score: string; comment: string; error?: string }>
  >(() => {
    const map: Record<string, { score: string; comment: string }> = {};
    for (const s of students) {
      const g = initialGrades.find((x) => x.student_id === s.id);
      map[s.id] = {
        score: g?.score != null ? String(g.score) : "",
        comment: g?.comment ?? "",
      };
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const max = assessment.max_score;

  function validateAll(): boolean {
    let ok = true;
    const next = { ...entries };
    for (const s of students) {
      const val = next[s.id].score;
      let err: string | undefined;
      if (val !== "") {
        const n = Number(val);
        if (Number.isNaN(n) || n < 0) err = "Note invalide";
        else if (n > max) err = `> ${max}`;
      }
      next[s.id] = { ...next[s.id], error: err };
      if (err) ok = false;
    }
    setEntries(next);
    return ok;
  }

  async function handleSave(publish: boolean) {
    setMessage(null);
    if (!validateAll()) {
      setMessage({ type: "error", text: "Vérifiez les notes en erreur avant d'enregistrer." });
      return;
    }
    setSaving(true);
    const grades = students
      .map((s) => ({
        studentId: s.id,
        score: Number(entries[s.id].score),
        comment: entries[s.id].comment || undefined,
      }))
      .filter((g) => !Number.isNaN(g.score));

    if (grades.length === 0) {
      setSaving(false);
      setMessage({ type: "error", text: "Aucune note saisie." });
      return;
    }

    const res = await saveClassGrades({ assessmentId: assessment.id, grades });
    if (res.error) {
      setSaving(false);
      setMessage({ type: "error", text: res.error });
      return;
    }
    if (publish) {
      const pRes = await publishGrades(assessment.id);
      if (pRes.error) {
        setSaving(false);
        setMessage({ type: "error", text: `Notes enregistrées, mais publication impossible : ${pRes.error}` });
        return;
      }
      setMessage({ type: "success", text: "Notes enregistrées et publiées." });
    } else {
      setMessage({ type: "success", text: "Notes enregistrées (brouillon)." });
    }
    setSaving(false);
    setPublishing(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 sm:p-6">
        <div className="space-y-1">
          <p className="text-sm font-medium">{assessment.title}</p>
          <p className="text-xs text-muted-foreground">
            Coefficient {assessment.coefficient} · sur {assessment.max_score} points
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {students.map((s) => {
          const e = entries[s.id];
          return (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {s.last_name} {s.first_name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max={max}
                    step="0.25"
                    placeholder="Note"
                    value={e.score}
                    aria-label={`Note de ${s.last_name} ${s.first_name}`}
                    className={e.error ? "border-destructive" : ""}
                    onChange={(ev) =>
                      setEntries((prev) => ({
                        ...prev,
                        [s.id]: { ...prev[s.id], score: ev.target.value, error: undefined },
                      }))
                    }
                  />
                  {e.error ? (
                    <p className="mt-0.5 text-[11px] text-destructive">{e.error}</p>
                  ) : null}
                </div>
                <Input
                  type="text"
                  placeholder="Commentaire"
                  value={e.comment}
                  className="w-40"
                  onChange={(ev) =>
                    setEntries((prev) => ({
                      ...prev,
                      [s.id]: { ...prev[s.id], comment: ev.target.value },
                    }))
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      {message ? (
        <p
          className={
            message.type === "error" ? "text-sm text-destructive" : "text-sm text-emerald-600"
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => handleSave(false)}
          disabled={saving || publishing}
        >
          {saving ? "Enregistrement…" : "Enregistrer (brouillon)"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setPublishing(true);
            void handleSave(true);
          }}
          disabled={saving || publishing}
        >
          {publishing ? "Publication…" : "Enregistrer et publier"}
        </Button>
      </div>

      <div className="pt-2">
        <Label className="text-xs text-muted-foreground">
          Enregistre toutes les notes en une seule opération. La publication
          notifie les parents.
        </Label>
      </div>
    </div>
  );
}
