"use client";

import { useState, useTransition } from "react";
import { getCommPrefs, updateCommPrefs } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function CommunicationPrefs({ schoolId }: { schoolId: string | null }) {
  const [prefs, setPrefs] = useState<{ smsEnabled: boolean; whatsappEnabled: boolean; emailEnabled: boolean; pushEnabled: boolean }>({
    smsEnabled: false,
    whatsappEnabled: false,
    emailEnabled: true,
    pushEnabled: true,
  });
  const [loaded, setLoaded] = useState(false);
  const [pending, start] = useTransition();

  // Load initial prefs on mount
  if (typeof window !== "undefined" && !loaded) {
    start(async () => {
      const res = await getCommPrefs();
      if (res) setPrefs(res);
      setLoaded(true);
    });
  }

  const save = (key: keyof typeof prefs, value: boolean) =>
    start(async () => {
      setPrefs((p) => ({ ...p, [key]: value }));
      const res = await updateCommPrefs({ [key]: value });
      if (res.error) alert(res.error);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Préférences de communication</CardTitle>
        <CardDescription>
          Choisissez comment vous souhaitez être notifié. Les notifications
          in-app sont toujours actives.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Toggle
          label="Email"
          checked={prefs.emailEnabled}
          onChange={(v) => save("emailEnabled", v)}
          disabled={pending || !loaded}
        />
        <Toggle
          label="Push (navigateur)"
          checked={prefs.pushEnabled}
          onChange={(v) => save("pushEnabled", v)}
          disabled={pending || !loaded}
        />
        <Toggle
          label="SMS"
          checked={prefs.smsEnabled}
          onChange={(v) => save("smsEnabled", v)}
          disabled={pending || !loaded}
        />
        <Toggle
          label="WhatsApp"
          checked={prefs.whatsappEnabled}
          onChange={(v) => save("whatsappEnabled", v)}
          disabled={pending || !loaded}
        />
      </CardContent>
    </Card>
  );
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <label className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <span className="absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow peer-checked:translate-x-6 peer-checked:bg-primary" />
      </label>
    </div>
  );
}