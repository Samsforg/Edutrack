/**
 * Validates that an academic year has a well-formed ISO date range
 * with the end date strictly after the start date.
 * Returns an error message, or null when valid.
 */
export function validateAcademicYearDates(
  startDate: string,
  endDate: string
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return "Date de début invalide";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return "Date de fin invalide";
  if (new Date(startDate) >= new Date(endDate)) {
    return "La date de fin doit être postérieure à la date de début";
  }
  return null;
}