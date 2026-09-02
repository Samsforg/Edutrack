// Database types for EduTrack (manually maintained to match supabase/migrations).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "PARENT";
export type SchoolStatus = "active" | "suspended" | "archived";
export type StudentStatus = "active" | "inactive" | "graduated" | "transferred";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type NotificationType =
  | "attendance"
  | "grade"
  | "announcement"
  | "system";
export type LinkRequestStatus = "pending" | "approved" | "rejected" | "expired";
export type AnnouncementAudience = "all" | "class";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
        };
      };
      schools: {
        Row: {
          id: string;
          name: string;
          code: string;
          logo_url: string | null;
          status: SchoolStatus;
          email: string | null;
          phone: string | null;
          address: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          logo_url?: string | null;
          status?: SchoolStatus;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          country?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          logo_url?: string | null;
          status?: SchoolStatus;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          country?: string | null;
        };
      };
      school_members: {
        Row: {
          id: string;
          user_id: string;
          school_id: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          school_id: string;
          role: UserRole;
        };
        Update: {
          id?: string;
          user_id?: string;
          school_id?: string;
          role?: UserRole;
        };
      };
      academic_years: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          start_date: string;
          end_date: string;
          is_current: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          start_date: string;
          end_date: string;
          is_current?: boolean;
        };
        Update: {
          id?: string;
          school_id?: string;
          name?: string;
          start_date?: string;
          end_date?: string;
          is_current?: boolean;
        };
      };
      classes: {
        Row: {
          id: string;
          school_id: string;
          academic_year_id: string | null;
          name: string;
          grade_level: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          academic_year_id?: string | null;
          name: string;
          grade_level?: string | null;
        };
        Update: {
          id?: string;
          school_id?: string;
          academic_year_id?: string | null;
          name?: string;
          grade_level?: string | null;
        };
      };
      teachers: {
        Row: {
          id: string;
          school_id: string;
          user_id: string | null;
          employee_number: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          user_id?: string | null;
          employee_number: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          school_id?: string;
          user_id?: string | null;
          employee_number?: string;
          first_name?: string;
          last_name?: string;
          email?: string | null;
          phone?: string | null;
          is_active?: boolean;
        };
      };
      subjects: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          code?: string | null;
        };
        Update: {
          id?: string;
          school_id?: string;
          name?: string;
          code?: string | null;
        };
      };
      class_subjects: {
        Row: {
          id: string;
          class_id: string;
          subject_id: string;
          teacher_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          subject_id: string;
          teacher_id?: string | null;
        };
        Update: {
          id?: string;
          class_id?: string;
          subject_id?: string;
          teacher_id?: string | null;
        };
      };
      students: {
        Row: {
          id: string;
          school_id: string;
          classroom_id: string | null;
          academic_year_id: string | null;
          matricule: string;
          link_code: string | null;
          first_name: string;
          last_name: string;
          birth_date: string | null;
          gender: string | null;
          status: StudentStatus;
          enrollment_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          classroom_id?: string | null;
          academic_year_id?: string | null;
          matricule: string;
          link_code?: string | null;
          first_name: string;
          last_name: string;
          birth_date?: string | null;
          gender?: string | null;
          status?: StudentStatus;
          enrollment_date?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          classroom_id?: string | null;
          academic_year_id?: string | null;
          matricule?: string;
          link_code?: string | null;
          first_name?: string;
          last_name?: string;
          birth_date?: string | null;
          gender?: string | null;
          status?: StudentStatus;
          enrollment_date?: string;
        };
      };
      parents: {
        Row: {
          id: string;
          school_id: string;
          user_id: string | null;
          first_name: string;
          last_name: string;
          phone: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          user_id?: string | null;
          first_name: string;
          last_name: string;
          phone?: string | null;
          email?: string | null;
        };
        Update: {
          id?: string;
          school_id?: string;
          user_id?: string | null;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          email?: string | null;
        };
      };
      student_parents: {
        Row: {
          id: string;
          student_id: string;
          parent_id: string;
          relationship: string | null;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          parent_id: string;
          relationship?: string | null;
          is_primary?: boolean;
        };
        Update: {
          id?: string;
          student_id?: string;
          parent_id?: string;
          relationship?: string | null;
          is_primary?: boolean;
        };
      };
      attendance: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          classroom_id: string | null;
          subject_id: string | null;
          attendance_date: string;
          status: AttendanceStatus;
          taken_by: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          classroom_id?: string | null;
          subject_id?: string | null;
          attendance_date: string;
          status: AttendanceStatus;
          taken_by?: string | null;
          note?: string | null;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_id?: string;
          classroom_id?: string | null;
          subject_id?: string | null;
          attendance_date?: string;
          status?: AttendanceStatus;
          taken_by?: string | null;
          note?: string | null;
        };
      };
      grades: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          subject_id: string;
          classroom_id: string | null;
          teacher_id: string | null;
          title: string;
          score: number;
          max_score: number;
          coefficient: number;
          grade_date: string;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          subject_id: string;
          classroom_id?: string | null;
          teacher_id?: string | null;
          title: string;
          score: number;
          max_score: number;
          coefficient?: number;
          grade_date?: string;
          comment?: string | null;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_id?: string;
          subject_id?: string;
          classroom_id?: string | null;
          teacher_id?: string | null;
          title?: string;
          score?: number;
          max_score?: number;
          coefficient?: number;
          grade_date?: string;
          comment?: string | null;
        };
      };
      announcements: {
        Row: {
          id: string;
          school_id: string;
          author_id: string | null;
          audience: AnnouncementAudience;
          classroom_id: string | null;
          title: string;
          body: string;
          important: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          author_id?: string | null;
          audience?: AnnouncementAudience;
          classroom_id?: string | null;
          title: string;
          body: string;
          important?: boolean;
        };
        Update: {
          id?: string;
          school_id?: string;
          author_id?: string | null;
          audience?: AnnouncementAudience;
          classroom_id?: string | null;
          title?: string;
          body?: string;
          important?: boolean;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string | null;
          link: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type?: NotificationType;
          title: string;
          body?: string | null;
          link?: string | null;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationType;
          title?: string;
          body?: string | null;
          link?: string | null;
          read_at?: string | null;
        };
      };
      student_link_requests: {
        Row: {
          id: string;
          school_id: string;
          parent_id: string | null;
          student_id: string;
          code: string;
          status: LinkRequestStatus;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          parent_id?: string | null;
          student_id: string;
          code: string;
          status?: LinkRequestStatus;
          expires_at: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          parent_id?: string | null;
          student_id?: string;
          code?: string;
          status?: LinkRequestStatus;
          expires_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      school_status: SchoolStatus;
      student_status: StudentStatus;
      attendance_status: AttendanceStatus;
      notification_type: NotificationType;
      link_request_status: LinkRequestStatus;
      announcement_audience: AnnouncementAudience;
    };
  };
}
