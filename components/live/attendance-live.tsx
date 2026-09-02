"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import type { AttendanceStatus } from "@/types/enums";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Présent",
  absent: "Absent",
  late: "Retard",
  excused: "Excusé",
};

const STATUS_VARIANTS: Record<
  AttendanceStatus,
  "default" | "destructive" | "secondary" | "outline"
> = {
  present: "default",
  absent: "destructive",
  late: "secondary",
  excused: "outline",
};

function todayISO() {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

type Props = {
  studentId: string;
  studentName: string;
};

/**
 * Shows today's attendance for one student and updates live via
 * Supabase Realtime (RLS-scoped to the parent's children).
 */
export function AttendanceLive({ studentId, studentName }: Props) {
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

    const supabase = createClient();
    const today = todayISO();

    // Open the Realtime channel only once the session token is attached, so
    // RLS-scoped postgres_changes events reach the browser. Subscribing before
    // auth resolves connects anonymously and silently drops events.
    void supabase.auth.getSession().then(({ data: session }) => {
      if (!active || !session.session) return;

      supabase
        .from("attendance")
        .select("status")
        .eq("student_id", studentId)
        .eq("attendance_date", today)
        .maybeSingle()
        .then(({ data }) => {
          if (active) {
            setStatus(data?.status ?? null);
            setLoading(false);
          }
        });

      channel = supabase.channel(`attendance-${studentId}`);
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "attendance",
            filter: `student_id=eq.${studentId}`,
          },
          (payload) => {
            const row = payload.new as
              | { status: AttendanceStatus; attendance_date: string }
              | null;
            if (row?.attendance_date === today) {
              setStatus(row.status);
            } else if (payload.eventType === "UPDATE") {
              const old = payload.old as { attendance_date?: string } | null;
              if (old?.attendance_date === today) setStatus(null);
            }
          }
        )
        .subscribe();
    });

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [studentId]);

  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">Aujourd&apos;hui</p>
      <p className="mt-1 text-sm font-medium">{studentName}</p>
      <div className="mt-2">
        {loading ? (
          <Badge variant="outline">Chargement…</Badge>
        ) : status ? (
          <Badge variant={STATUS_VARIANTS[status]}>
            {STATUS_LABELS[status]}
          </Badge>
        ) : (
          <Badge variant="outline">Pas encore pointé</Badge>
        )}
      </div>
    </div>
  );
}