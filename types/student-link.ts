import type { LinkRequestStatus } from "@/types/enums";

/** A persisted link-code row (never contains the plaintext code). */
export type StudentLinkCodeRow = {
  id: string;
  school_id: string;
  student_id: string;
  expires_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  used_at: string | null;
  created_by: string | null;
  created_at: string;
};

/** Admin view of a link request (student_link_requests). */
export type LinkRequestListItem = {
  id: string;
  status: LinkRequestStatus;
  created_at: string;
  expires_at: string;
  resolved_at: string | null;
  reason: string | null;
  parent_name: string | null;
  student_name: string | null;
  matricule: string | null;
};

/** Parent view of one of their own link requests. */
export type ParentLinkRequestListItem = {
  id: string;
  status: LinkRequestStatus;
  created_at: string;
  expires_at: string;
  reason: string | null;
  student_first_name: string | null;
  student_last_name: string | null;
  school_name: string | null;
  /** True when the request is pending but its expiry is past. */
  is_expired: boolean;
};

/** Confirmation data returned once a code has been validated. */
export type VerifiedLinkCode = {
  studentId: string;
  firstName: string;
  lastName: string;
  schoolName: string;
};