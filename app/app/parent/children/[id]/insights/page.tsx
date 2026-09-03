import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { getParentChildDetail } from "@/lib/db/parent";
import { listInsights } from "@/lib/ai/store";
import { InsightsList } from "@/components/ai/insights-list";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ParentChildInsightsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["PARENT"]);
  const child = await getParentChildDetail(id);
  if (!child) return notFound();

  const insights = await listInsights({ studentId: id, limit: 50 });

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/app/parent/children/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {child.student_first_name} {child.student_last_name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Signaux & alertes</h1>
        <p className="text-muted-foreground">
          Points de vigilance et progrès détectés pour votre enfant.
        </p>
      </div>
      <InsightsList
        insights={insights}
        empty="Aucun signal particulier à signaler pour le moment."
      />
    </div>
  );
}
