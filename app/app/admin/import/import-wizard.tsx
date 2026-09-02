"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildPreview,
  csvTemplate,
  IMPORT_SCHEMAS,
  type ImportEntityType,
  type ImportPreview,
} from "@/lib/import/parse";
import {
  importStudents,
  importTeachers,
  importParents,
  importClasses,
  importSubjects,
  type ImportResult,
} from "@/lib/actions/import";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Rows = { [k: string]: string };

const TYPES: { value: ImportEntityType; hint: string }[] = [
  { value: "students", hint: "Matricule, prénom, nom, classe…" },
  { value: "teachers", hint: "N° employé, prénom, nom, email…" },
  { value: "parents", hint: "Prénom, nom, email, téléphone" },
  { value: "classes", hint: "Nom, niveau, année scolaire" },
  { value: "subjects", hint: "Code, nom" },
];

export function ImportWizard({
  schoolId,
}: {
  schoolId: string;
}) {
  const router = useRouter();
  const [entity, setEntity] = useState<ImportEntityType>("students");
  const [fileName, setFileName] = useState("");
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  // Builder of the identity key for duplicate detection per entity.
  const identity = useMemo(() => {
    switch (entity) {
      case "students": return (r: Rows) => r.matricule?.trim();
      case "teachers": return (r: Rows) => r.employee_number?.trim();
      case "classes": return (r: Rows) => r.name?.trim();
      case "subjects": return (r: Rows) => r.code?.trim()?.toUpperCase();
      case "parents": return (r: Rows) => `${r.first_name?.trim()}|${r.last_name?.trim()}|${r.email?.trim() ?? ""}`;
      default: return undefined;
    }
  }, [entity]);

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setRaw(text);
      // Detect student duplicates against DB is server-side; for preview we use
      // in-file duplicates + a note that DB duplicates are checked at import.
      const p = buildPreview<Rows>(entity, text, { identity });
      setPreview(p);
      setResult(null);
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const blob = new Blob([csvTemplate(entity)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-${entity}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    const rows = preview.rows.filter((r) => r.valid).map((r) => r.data) as Record<string, string>[];
    const res = await runImport(entity, schoolId, rows);
    setBusy(false);
    setResult(res);
    router.refresh();
  }

  function reset() {
    setRaw("");
    setPreview(null);
    setResult(null);
    setFileName("");
  }

  const validCount = preview?.valid ?? 0;

  return (
    <div className="space-y-6">
      {/* Step 1: type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Type de données</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <Button
                key={t.value}
                type="button"
                variant={entity === t.value ? "default" : "outline"}
                onClick={() => {
                  setEntity(t.value);
                  reset();
                }}
                title={t.hint}
              >
                {IMPORT_SCHEMAS[t.value].label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: template + upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Modèle & chargement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Téléchargez le modèle, remplissez-le, puis chargez votre CSV
              (séparateur virgule).
            </p>
            <Button type="button" variant="secondary" onClick={downloadTemplate}>
              Télécharger le modèle {IMPORT_SCHEMAS[entity].label}
            </Button>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="csv">Fichier CSV</Label>
            <Input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {raw && (
              <p className="text-xs text-muted-foreground">
                {fileName} — {raw.split(/\r?\n/).filter(Boolean).length - 1} lignes
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: preview */}
      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Prévisualisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="secondary">{preview.total} lignes</Badge>
              <Badge className="bg-emerald-600">{preview.valid} valides</Badge>
              {preview.duplicates > 0 && (
                <Badge variant="secondary">{preview.duplicates} doublons</Badge>
              )}
              {preview.invalid > 0 && (
                <Badge variant="destructive">{preview.invalid} en erreur</Badge>
              )}
            </div>

            {preview.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune ligne détectée. Vérifiez le format.
              </p>
            ) : (
              <div className="max-h-72 overflow-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="p-2">Ligne</th>
                      {preview.header.map((h, idx) => (
                        <th key={idx} className="p-2">{h}</th>
                      ))}
                      <th className="p-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 200).map((r) => (
                      <tr key={r.row} className="border-t">
                        <td className="p-2">{r.row}</td>
                        {preview.header.map((h, idx) => (
                          <td key={idx} className="p-2">
                            {(r.data as Record<string, string>)[h] ?? ""}
                          </td>
                        ))}
                        <td className="p-2">
                          {r.duplicate ? (
                            <span className="text-amber-600">Doublon</span>
                          ) : r.valid ? (
                            <span className="text-emerald-600">✓</span>
                          ) : (
                            <span className="text-destructive" title={r.error?.error}>
                              ✕ {r.error?.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={confirm}
                disabled={busy || validCount === 0}
              >
                {busy ? "Import en cours…" : `Importer ${validCount} ligne(s)`}
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Recommencer
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Step 4: report */}
      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Rapport d&apos;import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="secondary">{result.total} analysées</Badge>
              <Badge className="bg-emerald-600">{result.inserted} importées</Badge>
              <Badge variant="secondary">{result.duplicates} ignorées (doublons)</Badge>
              <Badge variant="destructive">{result.errors?.length ?? 0} rejetées</Badge>
            </div>

            {result.errors && result.errors.length > 0 ? (
              <div className="max-h-60 overflow-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="p-2">Ligne</th>
                      <th className="p-2">Champ</th>
                      <th className="p-2">Valeur</th>
                      <th className="p-2">Erreur</th>
                      <th className="p-2">Solution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{e.row > -1 ? e.row : "—"}</td>
                        <td className="p-2">{e.field ?? "—"}</td>
                        <td className="p-2">{e.value ?? "—"}</td>
                        <td className="p-2 text-destructive">{e.error}</td>
                        <td className="p-2">{e.solution ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

async function runImport(
  entity: ImportEntityType,
  schoolId: string,
  rows: Record<string, string>[]
): Promise<ImportResult> {
  switch (entity) {
    case "students":
      return importStudents(schoolId, rows as never[]);
    case "teachers":
      return importTeachers(schoolId, rows as never[]);
    case "parents":
      return importParents(schoolId, rows as never[]);
    case "classes":
      return importClasses(schoolId, rows as never[]);
    case "subjects":
      return importSubjects(schoolId, rows as never[]);
  }
}
