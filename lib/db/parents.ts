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
  if (parents.length === 0) return [];

  const parentIds = parents.map((p) => p.id);
  const { data: links } = await supabase
    .from("student_parents")
    .select("parent_id, students(first_name, last_name)")
    .in("parent_id", parentIds);

  const byParent = new Map<string, string[]>();
  for (const l of (links ?? []) as unknown as {
    parent_id: string;
    students: { first_name: string; last_name: string } | null;
  }[]) {
    const s = l.students;
    const name = s ? `${s.first_name} ${s.last_name}` : "";
    const arr = byParent.get(l.parent_id) ?? [];
    if (name) arr.push(name);
    byParent.set(l.parent_id, arr);
  }

  return parents.map((p) => ({
    ...p,
    child_count: byParent.get(p.id)?.length ?? 0,
    children: byParent.get(p.id) ?? [],
  }));
}