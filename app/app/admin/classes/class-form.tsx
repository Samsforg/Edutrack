"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClass, deleteClass } from "@/lib/actions/classes";

export function ClassFormButton({
  schoolId,
  academicYears,
}: {
  schoolId: string;
  academicYears: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createClass({
        schoolId,
        name,
        gradeLevel: gradeLevel || undefined,
        academicYearId: academicYearId || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Classe créée");
      setName("");
      setGradeLevel("");
      setAcademicYearId("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nouvelle classe</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nouvelle classe</DialogTitle>
          <DialogDescription>
            Exemple : 6ème A, 5ème B…
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom de la classe</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="6ème A"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gradeLevel">Niveau (optionnel)</Label>
            <Input
              id="gradeLevel"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="Sixième"
            />
          </div>
          <div className="space-y-2">
            <Label>Année scolaire (optionnel)</Label>
            <Select value={academicYearId} onValueChange={setAcademicYearId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Aucune" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((y) => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ClassDeleteButton({
  classId,
  schoolId,
  name,
}: {
  classId: string;
  schoolId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Supprimer la classe ${name} ? Les élèves seront conservés (sans classe).`))
      return;
    startTransition(async () => {
      const result = await deleteClass(classId, schoolId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Classe supprimée");
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      onClick={onDelete}
      disabled={pending}
    >
      Supprimer
    </Button>
  );
}