export type ImportPreview = {
  row: number;
  matricule: string;
  firstName: string;
  lastName: string;
  className: string;
  valid: boolean;
  reason?: string;
};

/**
 * Pure validation used to render a preview before importing.
 */
export function previewStudentsRows(
  raw: string
): { rows: ImportPreview[]; message?: string } {
  const rows: ImportPreview[] = [];
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows, message: "Fichier vide" };
  }

  // Skip header if it doesn't look like data.
  const header = lines[0].toLowerCase();
  const startsAt = header.includes("matricule") ? 1 : 0;

  for (let i = startsAt; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    const [matricule, firstName, lastName, className] = parts;
    const reasons: string[] = [];
    if (!matricule) reasons.push("Matricule manquant");
    if (!firstName) reasons.push("Prénom manquant");
    if (!lastName) reasons.push("Nom manquant");
    rows.push({
      row: i + 1,
      matricule: matricule ?? "",
      firstName: firstName ?? "",
      lastName: lastName ?? "",
      className: className ?? "",
      valid: reasons.length === 0,
      reason: reasons.length ? reasons.join(", ") : undefined,
    });
  }

  return { rows };
}