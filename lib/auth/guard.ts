import { redirect } from "next/navigation";
import { getSession, roleHome } from "@/lib/auth/session";
import { canAccessRole } from "@/lib/permissions";
import type { Role } from "@/types/enums";

/**
 * Server-side guard for a role-restricted section.
 * Redirects unauthenticated users to /login and users without
 * the required role to their own home page.
 */
export async function requireRole(allowedRoles: Role[]) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  if (!canAccessRole(session.memberships, allowedRoles)) {
    redirect(session.primaryRole ? roleHome(session.primaryRole) : "/login");
  }
  return session;
}
