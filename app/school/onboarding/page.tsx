import { requireRole } from "@/lib/auth/guard";
import { PLAN_LIST, formatPrice } from "@/lib/billing/plans";
import { getSchoolProfile } from "@/lib/db/school";
import { OnboardingWizard } from "./onboarding-wizard";

async function resolveSchoolId() {
  const session = await requireRole(["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  const schoolId = session.memberships.find(
    (m) => m.role === "SCHOOL_ADMIN" && m.school_status === "active"
  )?.school_id;
  if (!schoolId) throw new Error("Aucune école active pour ce compte.");
  return schoolId;
}

export default async function OnboardingPage() {
  const schoolId = await resolveSchoolId();
  const profile = await getSchoolProfile(schoolId);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <OnboardingWizard
        schoolId={schoolId}
        initialProfile={{
          name: profile?.name ?? "",
          city: profile?.city ?? "",
          phone: profile?.phone ?? "",
          email: profile?.email ?? "",
        }}
        plans={PLAN_LIST.map((p) => ({
          code: p.code,
          name: p.name,
          priceLabel: formatPrice(p.price),
          isDefault: p.isDefault,
        }))}
      />
    </div>
  );
}
