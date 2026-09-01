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
import { createTeacher, deleteTeacher } from "@/lib/actions/teachers";

export function TeacherFormButton({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    employeeNumber: "",
    email: "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createTeacher({
        schoolId,
        ...form,
        email: form.email || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Enseignant créé");
      setForm({ firstName: "", lastName: "", employeeNumber: "", email: "" });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nouvel enseignant</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nouvel enseignant</DialogTitle>
          <DialogDescription>
            Avec un email, un compte est créé automatiquement.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-lastName">Nom</Label>
              <Input
                id="t-lastName"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-firstName">Prénom</Label>
              <Input
                id="t-firstName"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-emp">Numéro employé</Label>
            <Input
              id="t-emp"
              value={form.employeeNumber}
              onChange={(e) => setForm((f) => ({ ...f, employeeNumber: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-email">Email (créé un compte)</Label>
            <Input
              id="t-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
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

export function TeacherDeleteButton({
  teacherId,
  schoolId,
  name,
}: {
  teacherId: string;
  schoolId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Supprimer l'enseignant ${name} ?`)) return;
    startTransition(async () => {
      const result = await deleteTeacher(teacherId, schoolId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Enseignant supprimé");
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