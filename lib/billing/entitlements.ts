/**
 * EduTrack — Entitlements (droits de fonctionnalités & limites d'usage).
 *
 * Toute vérification serveur passe par ici. Le frontend n'utilise ces
 * fonctions que pour l'expérience utilisateur (masquer/afficher),
 * jamais comme garde-fou de sécurité.
 */

import { cache } from "react";
import {
  getSchoolSubscription,
  getUsage as dbGetUsage,
  canAdd as dbCanAdd,
} from "@/lib/db/billing";
import type {
  SchoolSubscription,
  UsageCounts,
  UsageResult,
  AccessDecision,
} from "@/lib/billing/types";

/** Récupère l'abonnement d'une école (avec cache réact). */
export const getSchoolSubscriptionCached = cache(async (schoolId: string) => {
  return getSchoolSubscription(schoolId);
});

/** Récupère le plan (sous forme d'abonnement). */
export async function getSchoolPlan(schoolId: string): Promise<SchoolSubscription | null> {
  return getSchoolSubscriptionCached(schoolId);
}

/** Vérifie qu'une fonctionnalité est active sur le plan courant. */
export async function checkFeatureAccess(
  schoolId: string,
  feature: keyof SchoolSubscription["planFeatures"]
): Promise<boolean> {
  const sub = await getSchoolSubscriptionCached(schoolId);
  if (!sub) return false;
  return sub.planFeatures[feature] === true;
}

/** Vérifie une limite d'usage (retourne true si l'ajout est permis). */
export async function checkUsageLimit(
  schoolId: string,
  type: "students" | "teachers" | "admins"
): Promise<boolean> {
  return dbCanAdd(type, schoolId);
}

/** Récupère l'usage en cours. */
export function getUsage(schoolId: string): Promise<UsageCounts> {
  return dbGetUsage(schoolId);
}

/** Usage + limites. */
export async function getUsageAndLimits(schoolId: string): Promise<UsageResult> {
  const [sub, usage] = await Promise.all([
    getSchoolSubscriptionCached(schoolId),
    getUsage(schoolId),
  ]);
  return {
    students: usage.students,
    teachers: usage.teachers,
    admins: usage.admins,
    studentsLimit: sub?.maxStudents ?? 0,
    teachersLimit: sub?.maxTeachers ?? 0,
    adminsLimit: sub?.maxAdmins ?? 0,
  };
}

/** Court-circuit booléens conformes à la spec. */
export async function canAddStudent(schoolId: string): Promise<boolean> {
  return checkUsageLimit(schoolId, "students");
}
export async function canAddTeacher(schoolId: string): Promise<boolean> {
  return checkUsageLimit(schoolId, "teachers");
}
export async function canAddAdmin(schoolId: string): Promise<boolean> {
  return checkUsageLimit(schoolId, "admins");
}

/** Décide l'accès d'une école à l'app applicative (voir access.ts). */
export function decideAccess(sub: SchoolSubscription | null): AccessDecision {
  if (!sub) {
    return {
      allowed: true,
      status: "suspended",
      reason: "Abonnement introuvable",
    };
  }
  switch (sub.effectiveStatus) {
    case "trialing":
    case "active":
      return { allowed: true, status: sub.effectiveStatus };
    case "past_due":
      return { allowed: true, status: "past_due", reason: "Paiement en attente" };
    case "canceled":
      // Accès jusqu'à la fin de la période payée.
      return { allowed: true, status: "canceled", reason: "Abonnement résilié" };
    case "expired":
      return {
        allowed: true,
        status: "expired",
        readOnly: true,
        reason: "Votre abonnement a expiré.",
      };
    case "suspended":
      return {
        allowed: false,
        status: "suspended",
        reason: "Abonnement suspendu.",
      };
    default:
      return { allowed: true, status: sub.effectiveStatus };
  }
}
