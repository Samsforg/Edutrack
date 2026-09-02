import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getNotifications } from "@/lib/db/notifications";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkAllReadButton } from "./mark-all-read";

const TYPE_ICONS: Record<string, string> = {
  attendance: "✓",
  grade: "★",
  announcement: "A",
  system: "●",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ParentNotificationsPage() {
  const session = await requireRole(["PARENT"]);
  const notifications = await getNotifications(session.user.id, 100);
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            {unread} non lue{unread > 1 ? "s" : ""}.
          </p>
        </div>
        {unread > 0 ? <MarkAllReadButton /> : null}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pas encore de notification</CardTitle>
            <CardDescription>
              Vous serez notifié en cas d&apos;absence, de retard ou de note
              concernant vos enfants.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Link key={n.id} href={n.link ?? "#"} className="block">
              <Card className={n.read_at ? "" : "border-primary/40"}>
                <CardContent className="flex items-start gap-3 p-4">
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      n.read_at
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {TYPE_ICONS[n.type] ?? "●"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium">{n.title}</span>
                      {n.read_at ? null : (
                        <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                          Nouveau
                        </Badge>
                      )}
                    </span>
                    {n.body ? (
                      <span className="block text-sm text-muted-foreground">
                        {n.body}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {formatDate(n.created_at)}
                    </span>
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}