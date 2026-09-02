import { createClient } from "@/lib/supabase/server";

export type AcademicYearDetail = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  class_count: number;
};

/**
 * Lists the academic years of a school with their class counts,
 * most recent first.
 */
export async function listAcademicYears(
  schoolId: string
): Promise<AcademicYearDetail[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("academic_years")
    .select("id, name, start_date, end_date, is_current")
    .eq("school_id", schoolId)
    .order("is_current", { ascending: false })
    .order("start_date", { ascending: false });

  if (error || !data) return [];

  const years = data as unknown as Omit<AcademicYearDetail, "class_count">[];

  const counts = await Promise.all(
    years.map((y) =>
      supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("academic_year_id", y.id)
    )
  );

  return years.map((y, i) => ({
    ...y,
    class_count: counts[i].count ?? 0,
  }));
}