/**
 * EduTrack — Types partagés de l'architecture de billing.
 */

import type { PlanCode, PlanFeature } from "@/lib/billing/plans";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired"
  | "suspended";

export type BillingProvider = "manual" | "stripe" | "paystack" | "flutterwave";

/** Vue serveur (db) d'un abonnement d'école, jointe au plan. */
export type SchoolSubscription = {
  id: string;
  schoolId: string;
  planId: string;
  planCode: PlanCode;
  planName: string;
  planPrice: number;
  planCurrency: string;
  planFeatures: PlanFeature;
  maxStudents: number;
  maxTeachers: number;
  maxAdmins: number;
  status: SubscriptionStatus;
  effectiveStatus: SubscriptionStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  provider: BillingProvider;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
};

/** Règles d'accès décidées par `requireActiveSubscription`. */
export type AccessDecision = {
  allowed: boolean;
  status: SubscriptionStatus;
  /** Lecture seule (abonnement expiré) : consultation, pas de création. */
  readOnly?: boolean;
  reason?: string;
};

export type UsageCounts = {
  students: number;
  teachers: number;
  admins: number;
};

export type UsageResult = {
  students: number;
  teachers: number;
  admins: number;
  studentsLimit: number;
  teachersLimit: number;
  adminsLimit: number;
};

export type LeadStatus = "new" | "contacted" | "demo" | "trial" | "converted" | "lost";

export const LEAD_STATUSES: readonly LeadStatus[] = [
  "new",
  "contacted",
  "demo",
  "trial",
  "converted",
  "lost",
];
