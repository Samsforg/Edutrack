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
  | "system"
  | "risk_detected"
  | "performance_drop"
  | "attendance_drop"
  | "positive_progress"
  | "weekly_summary"
  | "insight";

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "attendance",
  "grade",
  "announcement",
  "system",
  "risk_detected",
  "performance_drop",
  "attendance_drop",
  "positive_progress",
  "weekly_summary",
  "insight",
];

export type NotificationPriority = "critical" | "high" | "normal" | "low";

export type LinkRequestStatus = "pending" | "approved" | "rejected" | "expired";

export const LINK_REQUEST_STATUSES: readonly LinkRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
  "expired",
];

export type SchoolStatus = "active" | "suspended" | "archived";

export type StudentStatus = "active" | "inactive" | "graduated" | "transferred";

export const STUDENT_STATUSES: readonly StudentStatus[] = [
  "active",
  "inactive",
  "graduated",
  "transferred",
];
