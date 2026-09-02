import { createClient } from "@/lib/supabase/server";

export type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  href?: string;
};

/**
 * Calcule la checklist de configuration (9 items) pour une école.
 * Utilisé sur le dashboard SCHOOL_ADMIN (progression en %).
 */
export async function getSetupChecklist(schoolId: string): Promise<{
  items: ChecklistItem[];
  done: number;
  total: number;
}> {
  const supabase = await createClient();

  const [school, years, students, teachers, classes, subjects, members, attendance] =
    await Promise.all([
      supabase.from("schools").select("name, city, phone, email").eq("id", schoolId).maybeSingle(),
      supabase.from("academic_years").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
      supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "active"),
      supabase.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("is_active", true),
      supabase.from("classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
      supabase.from("subjects").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
      supabase.from("school_members").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
      supabase.from("attendance").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    ]);

  const profile = school.data;
  const doneProfile = Boolean(profile?.name && (profile.city || profile.phone || profile.email));

  const items: ChecklistItem[] = [
    {
      key: "profile",
      label: "Compléter la fiche établissement",
      done: doneProfile,
      href: "/app/admin/settings",
    },
    {
      key: "year",
      label: "Créer l'année scolaire",
      done: (years.count ?? 0) > 0,
      href: "/app/admin/academic-years",
    },
    {
      key: "students",
      label: "Ajouter les élèves",
      done: (students.count ?? 0) > 0,
      href: "/app/admin/students",
    },
    {
      key: "teachers",
      label: "Ajouter les enseignants",
      done: (teachers.count ?? 0) > 0,
      href: "/app/admin/teachers",
    },
    {
      key: "classes",
      label: "Créer les classes",
      done: (classes.count ?? 0) > 0,
      href: "/app/admin/classes",
    },
    {
      key: "subjects",
      label: "Ajouter les matières",
      done: (subjects.count ?? 0) > 0,
      href: "/app/admin/subjects",
    },
    {
      key: "team",
      label: "Compléter l'équipe",
      done: (members.count ?? 0) > 1,
      href: "/app/admin/teachers",
    },
    {
      key: "attendance",
      label: "Première prise d'appel",
      done: (attendance.count ?? 0) > 0,
      href: "/app/admin/classes",
    },
    {
      key: "subs",
      label: "Choisir un plan d'abonnement",
      done: false, // mis à jour par l'appelant (billing)
      href: "/school/billing",
    },
  ];

  return { items, done: 0, total: items.length };
}
