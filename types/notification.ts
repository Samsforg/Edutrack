import type { NotificationType } from "@/types/enums";

/** A single notification row scoped to the current user. */
export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};