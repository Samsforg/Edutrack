import { createClient } from "@/lib/supabase/server";

export type AnnouncementEntry = {
  id: string;
  school_id: string;
  title: string;
  body: string;
  important: boolean;
  audience: "all" | "class";
  created_at: string;
};

/**
 * Returns announcements visible to a parent for the given children.
 * Relies on RLS to already filter visibility; this only orders/limits.
 */
export async function getVisibleAnnouncements(
  schoolId: string,
  limit = 10
): Promise<AnnouncementEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, school_id, title, body, important, audience, created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as AnnouncementEntry[];
}
