import type { StudentStatus } from "@/types/enums";

/** A child linked to the current parent (parent portal list). */
export type ParentChild = {
  student_id: string;
  student_first_name: string;
  student_last_name: string;
  matricule: string;
  class_name: string | null;
  school_name: string | null;
  status: StudentStatus;
};

/** Full detail of a child, returned only when the parent is linked. */
export type ParentChildDetail = ParentChild & {
  birth_date: string | null;
  gender: string | null;
  enrollment_date: string | null;
  school_email: string | null;
  school_phone: string | null;
  school_city: string | null;
  school_address: string | null;
  academic_year_name: string | null;
};