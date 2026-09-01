import { describe, expect, it } from "vitest";
import {
  canAccessRole,
  hasRoleInSchool,
  isSuperAdmin,
  primarySchoolForRole,
  roleInSchool,
} from "@/lib/permissions";
import type { Membership } from "@/lib/auth/session";

const parent = (school: string): Membership => ({
  school_id: school,
  school_name: "School",
  school_status: "active",
  role: "PARENT",
});

const admin = (school: string): Membership => ({
  school_id: school,
  school_name: "School",
  school_status: "active",
  role: "SCHOOL_ADMIN",
});

const superAdmin: Membership = {
  school_id: "plat",
  school_name: "Plateforme",
  school_status: "active",
  role: "SUPER_ADMIN",
};

describe("permissions", () => {
  it("hasRoleInSchool detects the role for the school", () => {
    const memberships = [parent("s1"), admin("s2")];
    expect(hasRoleInSchool(memberships, "s2", ["SCHOOL_ADMIN"])).toBe(true);
    expect(hasRoleInSchool(memberships, "s1", ["SCHOOL_ADMIN"])).toBe(false);
  });

  it("isSuperAdmin only for SUPER_ADMIN role", () => {
    expect(isSuperAdmin([superAdmin])).toBe(true);
    expect(isSuperAdmin([admin("s1")])).toBe(false);
  });

  it("roleInSchool returns null when not a member", () => {
    expect(roleInSchool([parent("s1")], "s2")).toBeNull();
    expect(roleInSchool([parent("s1")], "s1")).toBe("PARENT");
  });

  it("canAccessRole works for allowed roles", () => {
    expect(canAccessRole([parent("s1")], ["PARENT"])).toBe(true);
    expect(canAccessRole([parent("s1")], ["SCHOOL_ADMIN"])).toBe(false);
  });

  it("primarySchoolForRole picks the first matching role", () => {
    expect(primarySchoolForRole([admin("s2"), parent("s1")], ["SCHOOL_ADMIN"])).toBe("s2");
    expect(primarySchoolForRole([parent("s1")], ["SCHOOL_ADMIN"])).toBeNull();
  });
});