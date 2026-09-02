import Link from "next/link";
import { Check } from "lucide-react";
import { getSetupChecklist } from "@/lib/db/checklist";
import { getSchoolSubscriptionCached } from "@/lib/billing/entitlements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export async function SetupChecklist({ schoolId }: { schoolId: string }) {
  const [checklist, sub] = await Promise.all([
    getSetupChecklist(schoolId),
    getSchoolSubscriptionCached(schoolId),
  ]);

  const subsItem = checklist.items.find((i) => i.key === "subs");
  if (subsItem) subsItem.done = !!sub && sub.status !== "trialing";

  const done = checklist.items.filter((i) => i.done).length;
  const total = checklist.items.length;
  const progress = Math.round((done / total) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Configuration</span>
          <span className="text-sm font-normal text-muted-foreground">
            {done}/{total} terminés
          </span>
        </CardTitle>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {checklist.items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
          >
            <span className={item.done ? "text-muted-foreground" : ""}>
              {item.label}
            </span>
            {item.done ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="h-3 w-3" />
              </span>
            ) : (
              <Button asChild variant="ghost" size="sm">
                <Link href={item.href ?? "/app/admin"}>Faire</Link>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
