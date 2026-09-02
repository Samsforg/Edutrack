/**
 * EduTrack — Catalogue des plans (source de vérité des prix & limites).
 *
 * RÈGLE : ne JAMAIS coder les montants (49000, 99000, 199000) dans les pages.
 * Toutes les lectures passent par ce module ou par la table `subscription_plans`.
 * Les valeurs ci-dessous doivent rester alignées avec le seed SQL (0017).
 */

export type PlanCode = "starter" | "standard" | "pro";

export const TRIAL_DAYS = 14;

export type PlanFeature = {
  presence: boolean;
  grades: boolean;
  announcements: boolean;
  notifications: boolean;
  parent_portal: boolean;
  dashboards: boolean;
  imports: boolean;
  reports_basic: boolean;
  analytics_advanced: boolean;
  reports_advanced: boolean;
  exports: boolean;
  priority_support: boolean;
  extended_history: boolean;
};

export type Plan = {
  code: PlanCode;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingInterval: "month" | "year";
  maxStudents: number;
  maxTeachers: number;
  maxAdmins: number;
  features: PlanFeature;
  isDefault: boolean;
  sortOrder: number;
};

export const PLANS: Record<PlanCode, Plan> = {
  starter: {
    code: "starter",
    name: "Starter",
    description: "Pour les petites écoles.",
    price: 49000,
    currency: "FCFA",
    billingInterval: "year",
    maxStudents: 150,
    maxTeachers: 15,
    maxAdmins: 1,
    features: {
      presence: true,
      grades: true,
      announcements: true,
      notifications: true,
      parent_portal: true,
      dashboards: true,
      imports: true,
      reports_basic: true,
      analytics_advanced: false,
      reports_advanced: false,
      exports: false,
      priority_support: false,
      extended_history: false,
    },
    isDefault: false,
    sortOrder: 1,
  },
  standard: {
    code: "standard",
    name: "Standard",
    description: "Le choix le plus populaire pour les écoles en croissance.",
    price: 99000,
    currency: "FCFA",
    billingInterval: "year",
    maxStudents: 500,
    maxTeachers: 50,
    maxAdmins: 3,
    features: {
      presence: true,
      grades: true,
      announcements: true,
      notifications: true,
      parent_portal: true,
      dashboards: true,
      imports: true,
      reports_basic: true,
      analytics_advanced: true,
      reports_advanced: true,
      exports: true,
      priority_support: false,
      extended_history: true,
    },
    isDefault: true,
    sortOrder: 2,
  },
  pro: {
    code: "pro",
    name: "Pro",
    description: "Pour les grands établissements et les besoins avancés.",
    price: 199000,
    currency: "FCFA",
    billingInterval: "year",
    maxStudents: 1500,
    maxTeachers: 150,
    maxAdmins: 10,
    features: {
      presence: true,
      grades: true,
      announcements: true,
      notifications: true,
      parent_portal: true,
      dashboards: true,
      imports: true,
      reports_basic: true,
      analytics_advanced: true,
      reports_advanced: true,
      exports: true,
      priority_support: true,
      extended_history: true,
    },
    isDefault: false,
    sortOrder: 3,
  },
};

export const PLAN_LIST: Plan[] = [PLANS.starter, PLANS.standard, PLANS.pro];

export function planByCode(code: string): Plan | undefined {
  return PLANS[code as PlanCode];
}

export function planById(code: PlanCode): Plan {
  return PLANS[code];
}

/** Met un prix FCFA en forme lisible (ex. "49 000 FCFA"). */
export function formatPrice(price: number, currency = "FCFA"): string {
  return `${price.toLocaleString("fr-FR")} ${currency}`;
}

/** Normalise le prix annuel en MRR (prix/12). */
export function annualPriceToMonthly(price: number): number {
  return price / 12;
}
