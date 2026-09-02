import { createClient } from "@/lib/supabase/server";

export type ParentDetail = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  child_count: number;
  children: string[];
};

/**
 * Lists the parents of a school with their linked children.
 */
export async function listParentsDetail(
  schoolId: string
): Promise<ParentDetail[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("parents")
    .select("id, first_name, last_name, phone, email")
    .eq("school_id", schoolId)
    .order("last_name", { ascending: true });

  if (error || !data) return [];

  const parents = data as unknown as Omit<ParentDetail, "child_count" | "children">[];

  const links = await Promise.all(
    parents.map((p) =>
      supabase
        .from("student_parents")
        .select("students(first_name, last_name)")
        .eq("parent_id", p.id)
    )
  );

  return parents.map((p, i) => {
    const children = (links[i].data ?? []).map(
      (l) =>
        `${(l.students as unknown as { first_name: string } | null)?.first_name ?? ""} ${
          (l.students as unknown as { last_name: string } | null)?.last_name ?? ""
        }`
    );
    return { ...p, child_count: children.length, children };
  });
}