"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { createAnnouncement } from "@/lib/actions/announcements";

export function AnnouncementForm({
  schoolId,
  classes,
}: {
  schoolId: string;
  classes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "class">("all");
  const [classroomId, setClassroomId] = useState("");
  const [important, setImportant] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createAnnouncement({
        schoolId,
        title,
        body,
        audience,
        classroomId: audience === "class" ? classroomId || undefined : undefined,
        important,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Annonce publiée");
      setTitle("");
      setBody("");
      setAudience("all");
      setClassroomId("");
      setImportant(false);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nouvelle annonce</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publier une annonce</DialogTitle>
          <DialogDescription>
            Destinée à toute l&apos;école ou à une classe précise.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="a-title">Titre</Label>
            <Input
              id="a-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="a-body">Contenu</Label>
            <Textarea
              id="a-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <Select
              value={audience}
              onValueChange={(v) => setAudience(v as "all" | "class")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toute l&apos;école</SelectItem>
                <SelectItem value="class">Une classe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {audience === "class" ? (
            <div className="space-y-2">
              <Label>Classe</Label>
              <Select value={classroomId} onValueChange={setClassroomId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir une classe" />
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
          ) : null}
          <div className="flex items-center gap-2">
            <Checkbox
              id="a-important"
              checked={important}
              onCheckedChange={(v) => setImportant(v === true)}
            />
            <Label htmlFor="a-important">Marquer comme important</Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Publication…" : "Publier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}