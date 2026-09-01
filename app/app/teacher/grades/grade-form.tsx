"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { saveGrade } from "@/lib/actions/grades";

type Props = {
  schoolId: string;
  classId: string;
  students: { id: string; label: string }[];
  subjects: { id: string; name: string }[];
};

export function GradeForm({ schoolId, classId, students, subjects }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [studentId, setStudentId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [form, setForm] = useState({
    title: "",
    score: "",
    maxScore: "20",
    coefficient: "1",
    date: new Date().toISOString().slice(0, 10),
    comment: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !subjectId) {
      toast.error("Sélectionnez un élève et une matière");
      return;
    }
    startTransition(async () => {
      const result = await saveGrade({
        schoolId,
        classId,
        studentId,
        subjectId,
        title: form.title,
        score: Number(form.score),
        maxScore: Number(form.maxScore),
        coefficient: Number(form.coefficient),
        date: form.date,
        comment: form.comment,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Note enregistrée");
      router.refresh();
      setForm((f) => ({ ...f, title: "", score: "", comment: "" }));
      setStudentId("");
    });
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={submit} className="space-y-4 pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="student">Élève</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger id="student" className="w-full">
                  <SelectValue placeholder="Choisir un élève" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Matière</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger id="subject" className="w-full">
                  <SelectValue placeholder="Choisir une matière" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Titre de l&apos;évaluation</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ex : Contrôle n°2"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="score">Note</Label>
              <Input
                id="score"
                type="number"
                min="0"
                step="0.01"
                value={form.score}
                onChange={(e) => set("score", e.target.value)}
                placeholder="15"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxScore">Sur</Label>
              <Input
                id="maxScore"
                type="number"
                min="1"
                step="0.01"
                value={form.maxScore}
                onChange={(e) => set("maxScore", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coef">Coefficient</Label>
              <Input
                id="coef"
                type="number"
                min="0.5"
                step="0.5"
                value={form.coefficient}
                onChange={(e) => set("coefficient", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Commentaire (optionnel)</Label>
            <Input
              id="comment"
              value={form.comment}
              onChange={(e) => set("comment", e.target.value)}
              placeholder="Observations"
            />
          </div>

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Enregistrement…" : "Enregistrer la note"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}