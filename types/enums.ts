export type Role = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "PARENT";

export const ROLES: readonly Role[] = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "TEACHER",
  "PARENT",
];

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  "present",
  "absent",
  "late",
  "excused",
];

export type NotificationType =
  | "attendance"
  | "grade"
  | "announcement"
  | "system";

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "attendance",
  "grade",
  "announcement",
  "system",
];

export type LinkRequestStatus = "pending" | "approved" | "rejected" | "expired";

export const LINK_REQUEST_STATUSES: readonly LinkRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
  "expired",
];

export type SchoolStatus = "active" | "suspended" | "archived";
