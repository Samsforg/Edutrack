import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/enums";

export type Membership = {
  school_id: string;
  school_name: string;
  school_status: string;
  role: Role;
};

export type SessionData = {
  user: User;
  memberships: Membership[];
  primaryRole: Role | null;
};

/**
 * Returns the authenticated user, or null when logged out.
 * Cached per request to avoid duplicated Supabase calls.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Returns the list of school memberships for the current user.
 */
export async function getUserMemberships(
  userId: string
): Promise<Membership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_members")
    .select("school_id, role, schools(name, status)")
    .eq("user_id", userId);

  if (error || !data) {
    return [];
  }

  const memberships = (data as unknown as {
    school_id: string;
    role: Role;
    schools: { name: string; status: string } | null;
  }[]).map((m) => ({
    school_id: m.school_id,
    school_name: m.schools?.name ?? "",
    school_status: m.schools?.status ?? "",
    role: m.role,
  }));

  return memberships;
}

/**
 * Loads the full session context: user + memberships + primary role.
 * Returns null when the user is not authenticated.
 */
export const getSession = cache(async (): Promise<SessionData | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const memberships = await getUserMemberships(user.id);

  // Determine the "highest" role to pick the primary dashboard.
  const rolePriority: Record<Role, number> = {
    SUPER_ADMIN: 4,
    SCHOOL_ADMIN: 3,
    TEACHER: 2,
    PARENT: 1,
  };

  let primaryRole: Role | null = null;
  for (const m of memberships) {
    if (!primaryRole || rolePriority[m.role] > rolePriority[primaryRole]) {
      primaryRole = m.role;
    }
  }

  return { user, memberships, primaryRole };
});

/**
 * Returns the home path based on the user's primary role.
 */
export function roleHome(role: Role): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/app/super-admin";
    case "SCHOOL_ADMIN":
      return "/app/admin";
    case "TEACHER":
      return "/app/teacher";
    case "PARENT":
      return "/app/parent";
  }
}
