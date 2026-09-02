"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { createSubject, deleteSubject } from "@/lib/actions/subjects";

const schema = z.object({
  name: z.string().min(1, "Nom requis"),
  code: z
    .string()
    .min(1, "Code requis")
    .max(20, "Code trop long")
    .regex(/^[A-Za-z0-9-_]+$/, "Caractères autorisés : lettres, chiffres, - et _"),
});

type FormValues = z.infer<typeof schema>;

export function SubjectFormButton({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", code: "" },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await createSubject({ ...values, schoolId });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Matière créée");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nouvelle matière</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nouvelle matière</DialogTitle>
          <DialogDescription>
            Le code doit être unique au sein de l’établissement.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" placeholder="Sciences de la vie" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" placeholder="SVT" {...register("code")} />
            {errors.code && (
              <p className="text-sm text-destructive">{errors.code.message}</p>
            )}
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

export function SubjectDeleteButton({
  subjectId,
  schoolId,
  name,
}: {
  subjectId: string;
  schoolId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Supprimer la matière ${name} ?`)) return;
    startTransition(async () => {
      const result = await deleteSubject(subjectId, schoolId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Matière supprimée");
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