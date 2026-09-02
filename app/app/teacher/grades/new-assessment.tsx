"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAssessment } from "@/lib/actions/academic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AcademicPeriod } from "@/lib/db/academic";

type Props = {
  schoolId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  periods: AcademicPeriod[];
  defaultPeriodId: string;
};

export function NewAssessmentButton({
  schoolId,
  classId,
  subjectId,
  teacherId,
  periods,
  defaultPeriodId,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    maxScore: "20",
    coefficient: "1",
    assessmentDate: new Date().toISOString().slice(0, 10),
    periodId: defaultPeriodId,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await createAssessment({
      schoolId,
      classId,
      subjectId,
      teacherId,
      academicPeriodId: form.periodId,
      title: form.title,
      description: form.description || undefined,
      maxScore: Number(form.maxScore),
      coefficient: Number(form.coefficient),
      assessmentDate: form.assessmentDate,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
    if (res.id) router.push(`/app/teacher/grades/${res.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nouvelle évaluation</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Nouvelle évaluation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Devoir surveillé N°1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="max">Note maximale</Label>
                <Input
                  id="max"
                  type="number"
                  min="1"
                  step="0.5"
                  required
                  value={form.maxScore}
                  onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coef">Coefficient</Label>
                <Input
                  id="coef"
                  type="number"
                  min="0.5"
                  step="0.5"
                  required
                  value={form.coefficient}
                  onChange={(e) => setForm({ ...form, coefficient: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  required
                  value={form.assessmentDate}
                  onChange={(e) => setForm({ ...form, assessmentDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Période</Label>
                <Select value={form.periodId} onValueChange={(v) => setForm({ ...form, periodId: v })}>
                  <SelectTrigger><SelectValue placeholder="Période" /></SelectTrigger>
                  <SelectContent>
                    {periods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Création…" : "Créer l'évaluation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
