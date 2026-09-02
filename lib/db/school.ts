import { createClient } from "@/lib/supabase/server";

export type SchoolProfile = {
  id: string;
  name: string;
  code: string;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
};

/**
 * Returns the profile of the given school, or null when unavailable.
 */
export async function getSchoolProfile(schoolId: string): Promise<SchoolProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schools")
    .select(
      "id, name, code, logo_url, email, phone, address, city, country"
    )
    .eq("id", schoolId)
    .maybeSingle();

  if (error || !data) return null;
  return data as SchoolProfile;
}