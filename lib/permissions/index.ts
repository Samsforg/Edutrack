import type { Role } from "@/types/enums";
import type { Membership } from "@/lib/auth/session";

/**
 * Checks whether the user (via their memberships) holds at least
 * one of the given roles in the given school.
 */
export function hasRoleInSchool(
  memberships: Membership[],
  schoolId: string,
  roles: Role[]
): boolean {
  return memberships.some(
    (m) => m.school_id === schoolId && roles.includes(m.role)
  );
}

/**
 * Checks whether the user is a SUPER_ADMIN on any school.
 */
export function isSuperAdmin(memberships: Membership[]): boolean {
  return memberships.some((m) => m.role === "SUPER_ADMIN");
}

/**
 * Returns the role the user holds in a specific school,
 * or null when they are not a member.
 */
export function roleInSchool(
  memberships: Membership[],
  schoolId: string
): Role | null {
  const m = memberships.find((m) => m.school_id === schoolId);
  return m?.role ?? null;
}

/**
 * Guards a route requiring one of the allowed roles.
 * Returns the school id to scope to, or null when forbidden.
 */
export function canAccessRole(
  memberships: Membership[],
  allowedRoles: Role[]
): boolean {
  return memberships.some((m) => allowedRoles.includes(m.role));
}

/**
 * Returns the primary school id for the given role, i.e. the first
 * membership matching any of the allowed roles.
 */
export function primarySchoolForRole(
  memberships: Membership[],
  allowedRoles: Role[]
): string | null {
  const m = memberships.find((mm) => allowedRoles.includes(mm.role));
  return m?.school_id ?? null;
}
