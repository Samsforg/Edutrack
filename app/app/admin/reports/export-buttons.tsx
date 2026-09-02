"use client";

import { useState } from "react";
import { generateReport } from "@/lib/actions/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReportType = "students" | "attendance" | "grades" | "stats";

export function ExportButtons({
  schoolId,
  selectedClass,
}: {
  schoolId: string;
  selectedClass: string;
  from: string;
  to: string;
}) {
  const [busy, setBusy] = useState<ReportType | null>(null);
  const [error, setError] = useState("");

  async function exportCsv(type: ReportType) {
    setBusy(type);
    setError("");
    const res = await generateReport(schoolId, type, {
      classId: selectedClass || undefined,
    });
    setBusy(null);
    if (res.error || !res.ok) {
      setError(res.error ?? "Erreur d'export");
      return;
    }
    // TS: generateReport returns lines; download as CSV.
    const blob = new Blob([res.lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `edutrack-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const btn = (type: ReportType, label: string) => (
    <Button
      key={type}
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void exportCsv(type)}
      disabled={busy !== null}
    >
      {busy === type ? "Export…" : label}
    </Button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Exporter (CSV)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {btn("students", "Élèves")}
          {btn("attendance", "Assiduité")}
          {btn("grades", "Notes")}
          {btn("stats", "Statistiques")}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <p className="text-xs text-muted-foreground">
          Généré côté serveur, filtré par établissement, échappé contre
          l&apos;injection CSV.
        </p>
      </CardContent>
    </Card>
  );
}
