"use client";

import { useTransition } from "react";
import { updateFlagAction, runJobAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RolloutLevel } from "@/lib/ai/types";

const LEVELS: RolloutLevel[] = ["disabled", "internal", "pilot", "beta", "enabled"];
const JOB_LABELS: Record<string, string> = {
  "detect-attendance-risks": "Détecter les risques d'assiduité",
  "detect-performance-risks": "Détecter les risques de performance",
  "detect-class-anomalies": "Anomalies de classes",
  "cleanup-expired-insights": "Nettoyer les insights expirés",
};

export function AIControls({
  flags,
}: {
  flags: { id: string; key: string; rollout: RolloutLevel }[];
}) {
  const [pending, start] = useTransition();
  const setRollout = (key: string, level: RolloutLevel) =>
    start(async () => {
      await updateFlagAction(key, level);
    });

  return (
    <div className="space-y-2">
      {flags.map((f) => (
        <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-2 last:border-0">
          <div>
            <p className="font-medium">{f.key}</p>
            <Badge variant="outline">{f.rollout}</Badge>
          </div>
          <div className="flex gap-1">
            {LEVELS.map((l) => (
              <Button
                key={l}
                size="sm"
                variant={f.rollout === l ? "default" : "outline"}
                onClick={() => setRollout(f.key, l)}
                disabled={pending}
              >
                {l}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function JobRunner() {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(JOB_LABELS).map(([type, label]) => (
        <Button
          key={type}
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => start(() => runJobAction(type as never))}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
