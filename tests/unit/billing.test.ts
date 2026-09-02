import { describe, expect, it } from "vitest";
import { PLANS, PLAN_LIST, formatPrice, annualPriceToMonthly, TRIAL_DAYS } from "@/lib/billing/plans";
import { effectiveStatus } from "@/lib/db/billing";
import { decideAccess } from "@/lib/billing/entitlements";
import { normalizeStatus } from "@/lib/billing/provider";
import type { SchoolSubscription } from "@/lib/billing/types";

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function sub(over: Partial<SchoolSubscription>): SchoolSubscription {
  const status = over.status ?? "active";
  return {
    id: "s",
    schoolId: "school",
    planId: "p",
    planCode: "standard",
    planName: "Standard",
    planPrice: 99000,
    planCurrency: "FCFA",
    planFeatures: PLANS.standard.features,
    maxStudents: 500,
    maxTeachers: 50,
    maxAdmins: 3,
    status,
    effectiveStatus: status,
    trialStartedAt: null,
    trialEndsAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: daysFromNow(30),
    provider: "manual",
    providerCustomerId: null,
    providerSubscriptionId: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    ...over,
  };
}

describe("plans.ts", () => {
  it("expose 3 plans avec Standard en défaut", () => {
    expect(PLAN_LIST).toHaveLength(3);
    expect(PLANS.standard.isDefault).toBe(true);
    expect(PLANS.starter.maxStudents).toBe(150);
    expect(PLANS.pro.maxStudents).toBe(1500);
    expect(PLANS.starter.price).toBe(49000);
    expect(PLANS.pro.price).toBe(199000);
  });

  it("TRIAL_DAYS vaut 14", () => {
    expect(TRIAL_DAYS).toBe(14);
  });

  it("formatPrice met les espaces et la devise", () => {
    const result1 = formatPrice(49000);
    expect(result1).toContain("49");
    expect(result1).toContain("000");
    expect(result1).toContain("FCFA");
    const result2 = formatPrice(99000, "FCFA");
    expect(result2).toContain("99");
    expect(result2).toContain("000");
    expect(result2).toContain("FCFA");
  });

  it("annualPriceToMonthly normalise en MRR (prix/12)", () => {
    expect(annualPriceToMonthly(99000)).toBeCloseTo(8250, 4);
    expect(annualPriceToMonthly(199000)).toBeCloseTo(16583.333, 2);
  });

  it("chaque plan a ses features documentées", () => {
    expect(PLANS.starter.features.reports_basic).toBe(true);
    expect(PLANS.starter.features.analytics_advanced).toBe(false);
    expect(PLANS.standard.features.analytics_advanced).toBe(true);
    expect(PLANS.standard.features.exports).toBe(true);
    expect(PLANS.pro.features.priority_support).toBe(true);
  });
});

describe("effectiveStatus", () => {
  it("trialing avec date passée est expired", () => {
    const r = effectiveStatus(
      sub({ status: "trialing", trialEndsAt: daysFromNow(-1) })
    );
    expect(r).toBe("expired");
  });

  it("trialing avec date future reste trialing", () => {
    const r = effectiveStatus(
      sub({ status: "trialing", trialEndsAt: daysFromNow(5) })
    );
    expect(r).toBe("trialing");
  });

  it("active avec période terminée est expired", () => {
    const r = effectiveStatus(sub({ status: "active", currentPeriodEnd: daysFromNow(-1) }));
    expect(r).toBe("expired");
  });

  it("canceled garde accès jusqu'à la fin de période", () => {
    const r = effectiveStatus(
      sub({ status: "canceled", currentPeriodEnd: daysFromNow(10) })
    );
    expect(r).toBe("canceled");
  });

  it("canceled avec période passée devient expired", () => {
    const r = effectiveStatus(
      sub({ status: "canceled", currentPeriodEnd: daysFromNow(-2) })
    );
    expect(r).toBe("expired");
  });

  it("past_due reste past_due", () => {
    const r = effectiveStatus(sub({ status: "past_due", currentPeriodEnd: daysFromNow(10) }));
    expect(r).toBe("past_due");
  });
});

describe("decideAccess", () => {
  it("aucun abonnement → pas bloqué (traitement défensif)", () => {
    const d = decideAccess(null);
    expect(d.allowed).toBe(true);
  });

  it("trialing autorise", () => {
    const d = decideAccess(sub({ status: "trialing", trialEndsAt: daysFromNow(3) }));
    expect(d.allowed).toBe(true);
    expect(d.readOnly).toBeUndefined();
  });

  it("active autorise en lecture/écriture", () => {
    const d = decideAccess(sub({ status: "active" }));
    expect(d.allowed).toBe(true);
  });

  it("past_due autorise (politique) mais signale", () => {
    const d = decideAccess(sub({ status: "past_due" }));
    expect(d.allowed).toBe(true);
    expect(d.status).toBe("past_due");
  });

  it("canceled autorise jusqu'à fin de période", () => {
    const d = decideAccess(sub({ status: "canceled", currentPeriodEnd: daysFromNow(5) }));
    expect(d.allowed).toBe(true);
    expect(d.status).toBe("canceled");
  });

  it("expired → lecture seule (readOnly)", () => {
    const d = decideAccess(
      sub({ status: "expired", currentPeriodEnd: daysFromNow(-1) })
    );
    expect(d.allowed).toBe(true);
    expect(d.readOnly).toBe(true);
  });

  it("suspended → accès refusé", () => {
    const d = decideAccess(sub({ status: "suspended" }));
    expect(d.allowed).toBe(false);
  });
});

describe("provider.normalizeStatus", () => {
  it("normalise les statuts valides et retombe sur active sinon", () => {
    expect(normalizeStatus("trialing")).toBe("trialing");
    expect(normalizeStatus("past_due")).toBe("past_due");
    expect(normalizeStatus("canceled")).toBe("canceled");
    expect(normalizeStatus("bogus" as never)).toBe("active");
    expect(normalizeStatus(undefined)).toBe("active");
  });
});