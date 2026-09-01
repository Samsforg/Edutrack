"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NotificationEntry } from "@/lib/db/notifications";
import type { NotificationType } from "@/types/enums";

type RealtimeNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const TYPE_ICONS: Record<NotificationType, string> = {
  attendance: "✓",
  grade: "★",
  announcement: "A",
  system: "●",
};

/**
 * Notification bell with live unread count, refreshed by Supabase Realtime.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<NotificationEntry[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    let active = true;
    void supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (!active) return;
        const rows = (data ?? []) as RealtimeNotification[];
        setItems(rows);
        setUnread(rows.filter((n) => !n.read_at).length);
      });

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!active) return;
          const row = payload.new as RealtimeNotification | null;
          if (payload.eventType === "INSERT" && row) {
            setItems((prev) => [row, ...prev].slice(0, 10));
            setUnread((u) => u + 1);
          } else if (payload.eventType === "UPDATE" && row) {
            setItems((prev) =>
              prev.map((n) => (n.id === row.id ? row : n))
            );
            const old = payload.old as { read_at?: string | null } | null;
            if (old?.read_at == null && row.read_at != null) {
              setUnread((u) => Math.max(0, u - 1));
            }
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 px-0" aria-label="Notifications">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unread > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Aucune notification.
          </div>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              asChild
              className="cursor-pointer items-start gap-2"
              onSelect={() => {
                if (n.read_at) return;
                void createClient()
                  .from("notifications")
                  .update({ read_at: new Date().toISOString() })
                  .eq("id", n.id);
              }}
            >
              {n.link ? (
                <Link href={n.link} className="flex items-start gap-2 whitespace-normal">
                  <NotificationIcon type={n.type} unread={!n.read_at} />
                  <span className={n.read_at ? "opacity-60" : ""}>
                    <span className="block text-sm font-medium">{n.title}</span>
                    {n.body ? (
                      <span className="block text-xs text-muted-foreground">
                        {n.body}
                      </span>
                    ) : null}
                  </span>
                </Link>
              ) : (
                <span className="flex items-start gap-2 whitespace-normal">
                  <NotificationIcon type={n.type} unread={!n.read_at} />
                  <span className={n.read_at ? "opacity-60" : ""}>
                    <span className="block text-sm font-medium">{n.title}</span>
                    {n.body ? (
                      <span className="block text-xs text-muted-foreground">
                        {n.body}
                      </span>
                    ) : null}
                  </span>
                </span>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationIcon({
  type,
  unread,
}: {
  type: NotificationType;
  unread: boolean;
}) {
  return (
    <span
      className={
        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] " +
        (unread
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground")
      }
    >
      {TYPE_ICONS[type]}
    </span>
  );
}