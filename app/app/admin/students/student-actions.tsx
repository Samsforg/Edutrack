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
import { createStudent, deleteStudent, updateStudentStatus } from "@/lib/actions/students";
import { STUDENT_STATUSES } from "@/types/enums";
import type { StudentListItem } from "@/lib/db/students";

const statusLabels: Record<string, string> = {
  active: "Actif",
  inactive: "Inactif",
  graduated: "Diplômé",
  transferred: "Transféré",
};

export function StudentStatusSelect({
  student,
  schoolId,
}: {
  student: StudentListItem;
  schoolId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    startTransition(async () => {
      const result = await updateStudentStatus({
        studentId: student.id,
        schoolId,
        status: value as (typeof STUDENT_STATUSES)[number],
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Statut mis à jour");
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          student.status === "active"
            ? "bg-emerald-500"
            : student.status === "inactive"
              ? "bg-amber-500"
              : "bg-muted-foreground"
        }`}
      />
      <select
        value={student.status}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="h-7 rounded border-none bg-transparent text-sm disabled:opacity-50"
      >
        {STUDENT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {statusLabels[s]}
          </option>
        ))}
      </select>
    </span>
  );
}

export function StudentFormButton({
  schoolId,
  classes,
}: {
  schoolId: string;
  classes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [classroomId, setClassroomId] = useState<string>("");
  const [form, setForm] = useState({
    matricule: "",
    firstName: "",
    lastName: "",
    birthDate: "",
    gender: "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createStudent({
        schoolId,
        classroomId: classroomId || undefined,
        matricule: form.matricule,
        firstName: form.firstName,
        lastName: form.lastName,
        birthDate: form.birthDate || undefined,
        gender: form.gender || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Élève créé avec un code de liaison");
      setForm({
        matricule: "",
        firstName: "",
        lastName: "",
        birthDate: "",
        gender: "",
      });
      setClassroomId("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nouvel élève</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvel élève</DialogTitle>
          <DialogDescription>
            Un code de liaison sera généré automatiquement.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="matricule">Matricule</Label>
            <Input
              id="matricule"
              value={form.matricule}
              onChange={(e) => setForm((f) => ({ ...f, matricule: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Classe</Label>
            <Select value={classroomId} onValueChange={setClassroomId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Aucune" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="birthDate">Date de naissance</Label>
              <Input
                id="birthDate"
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Sexe</Label>
              <Select
                value={form.gender}
                onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}
              >
                <SelectTrigger id="gender" className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculin</SelectItem>
                  <SelectItem value="F">Féminin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Création…" : "Créer l'élève"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StudentDeleteButton({
  studentId,
  schoolId,
  name,
}: {
  studentId: string;
  schoolId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Supprimer l'élève ${name} ?`)) return;
    startTransition(async () => {
      const result = await deleteStudent(studentId, schoolId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Élève supprimé");
      router.refresh();
    });
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={onDelete}
      disabled={pending}
    >
      Supprimer
    </Button>
  );
}