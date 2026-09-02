/**
 * CSV formatting helpers (pure, no server deps — usable from tests and client).
 */

/**
 * Neutralizes CSV formula injection for cells starting with =, +, -, @
 * (and tab/carriage-return) that could be interpreted by a spreadsheet.
 */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@]/.test(s) || /[\t\r\n]/.test(s)) {
    s = "'" + s;
  }
  return '"' + s.replace(/"/g, '""') + '"';
}

export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(sanitizeCsvCell).join(",");
}
