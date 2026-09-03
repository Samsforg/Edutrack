"use client";

import { useState, useTransition } from "react";
import { askSchoolAssistant } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import type { AssistantReply } from "@/lib/ai/assistant";

const SUGGESTIONS = [
  "Quels élèves sont à surveiller cette semaine ?",
  "Quelle est la tendance d'assiduité ?",
  "Quelles classes ont le plus de risques ?",
];

export function AssistantChat() {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [pending, start] = useTransition();

  const run = (q: string) => {
    if (!q.trim()) return;
    start(async () => {
      const r = await askSchoolAssistant(q);
      setReply(r);
    });
  };

  return (
    <div className="space-y-4">
      <Textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Posez une question sur vos données (périmètre : votre école uniquement)."
        rows={3}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => run(question)} disabled={pending || !question.trim()}>
          {pending ? "Réflexion…" : "Demander"}
        </Button>
        {SUGGESTIONS.map((s) => (
          <Button key={s} size="sm" variant="outline" onClick={() => run(s)} disabled={pending}>
            {s}
          </Button>
        ))}
      </div>

      {reply ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            {reply.answer.split("\n").filter(Boolean).map((line, i) => (
              <p key={i} className="whitespace-pre-wrap text-sm">
                {line}
              </p>
            ))}
            <div className="flex items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
              <span>Périmètre : {reply.scopedTo}</span>
              <span>·</span>
              <span>Sources : {reply.sources}</span>
              <span>·</span>
              <span>Moteur : {reply.provider}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
