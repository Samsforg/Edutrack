"use client";

import { useTransition } from "react";
import { updateStatusAction } from "./actions";
import { Button } from "@/components/ui/button";
import type { AiInsightStatus } from "@/lib/ai/types";

export function StatusActions({ insight }: { insight: { id: string; status: AiInsightStatus } }) {
  const [pending, start] = useTransition();

  const go = (s: AiInsightStatus) => {
    start(async () => {
      await updateStatusAction(insight.id, s);
    });
  };

  if (insight.status === "acknowledged" || insight.status === "resolved") {
    return (
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => go("active")}>
          Réactiver
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => go("dismissed")}>
          Ignorer
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => go("acknowledged")}>
        Reconnaître
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => go("resolved")}>
        Résoudre
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => go("dismissed")}>
        Ignorer
      </Button>
    </div>
  );
}
