"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  previewStudentsRows,
  type ImportPreview,
} from "@/lib/import/parse";
import { importStudents } from "@/lib/actions/import";

export function ImportStudentsForm({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview[] | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setPreview(null);
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { rows } = previewStudentsRows(text);
      setPreview(rows);
    };
    reader.readAsText(f);
  }

  const validCount = useMemo(
    () => preview?.filter((r) => r.valid).length ?? 0,
    [preview]
  );

  function runImport() {
    if (!preview) return;
    const valid = preview
      .filter((r) => r.valid)
      .map((r) => ({
        matricule: r.matricule,
        firstName: r.firstName,
        lastName: r.lastName,
        className: r.className || undefined,
      }));
    startTransition(async () => {
      const result = await importStudents(schoolId, valid);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${result.inserted ?? 0} importé(s), ${result.duplicates ?? 0} doublon(s)`
      );
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fichier CSV</CardTitle>
        <CardDescription>
          La validation est effectuée avant l&apos;import.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="csv">Fichier .csv</Label>
          <Input
            id="csv"
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
          />
        </div>

        {file ? (
          <p className="text-sm text-muted-foreground">
            {file.name} — {preview ? `${preview.length} ligne(s)` : "Lecture…"}
          </p>
        ) : null}

        {preview ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {validCount} ligne(s) valide(s)
              </Badge>
              <Badge variant="outline">
                {preview.length - validCount} ligne(s) invalide(s)
              </Badge>
            </div>

            {validCount > 0 ? (
              <Button onClick={runImport} disabled={pending}>
                {pending ? "Import en cours…" : `Importer ${validCount} élève(s)`}
              </Button>
            ) : null}

            {preview.some((r) => !r.valid) ? (
              <Card>
                <CardContent className="max-h-60 space-y-2 overflow-y-auto p-4">
                  {preview
                    .filter((r) => !r.valid)
                    .map((r) => (
                      <p key={r.row} className="text-sm text-destructive">
                        Ligne {r.row} : {r.reason}
                      </p>
                    ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}