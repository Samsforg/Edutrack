"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/auth/actions";
import type { Membership } from "@/lib/auth/session";
import { NotificationBell } from "@/components/live/notification-bell";

export type AppShellProps = {
  user: { id: string; email: string; fullName: string };
  memberships: Membership[];
  homePath: string;
  children: React.ReactNode;
};

const adminNav = [
  { href: "/app/admin", label: "Tableau de bord" },
  { href: "/app/admin/students", label: "Élèves" },
  { href: "/app/admin/teachers", label: "Enseignants" },
  { href: "/app/admin/classes", label: "Classes" },
  { href: "/app/admin/subjects", label: "Matières" },
  { href: "/app/admin/academic-years", label: "Années scolaires" },
  { href: "/app/admin/parents", label: "Parents" },
  { href: "/app/admin/announcements", label: "Annonces" },
  { href: "/app/admin/link-requests", label: "Codes & demandes" },
  { href: "/app/admin/settings", label: "Paramètres" },
];

const parentNav = [
  { href: "/app/parent", label: "Tableau de bord" },
  { href: "/app/parent/children", label: "Mes enfants" },
  { href: "/app/parent/announcements", label: "Annonces" },
  { href: "/app/parent/notifications", label: "Notifications" },
  { href: "/app/parent/link", label: "Lier un enfant" },
  { href: "/app/parent/link-requests", label: "Mes demandes" },
];

const teacherNav = [
  { href: "/app/teacher", label: "Tableau de bord" },
  { href: "/app/teacher/attendance", label: "Assiduité" },
  { href: "/app/teacher/attendance/history", label: "Historique" },
  { href: "/app/teacher/grades", label: "Évaluations & notes" },
];

export function AppShell({ user, memberships, homePath, children }: AppShellProps) {
  const pathname = usePathname();
  const isAdmin = memberships.some((m) => m.role === "SCHOOL_ADMIN");
  const isParent = memberships.some(
    (m) => m.role === "PARENT" && pathname.startsWith("/app/parent")
  );
  const isTeacher = memberships.some(
    (m) => m.role === "TEACHER" && pathname.startsWith("/app/teacher")
  );

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Link href={homePath} className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              E
            </span>
            <span className="font-bold">EduTrack</span>
          </Link>

          <div className="flex items-center gap-1">
          <NotificationBell userId={user.id} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[140px] truncate sm:block">
                  {user.fullName || user.email}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">
                {user.fullName || user.email}
              </DropdownMenuLabel>
              <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/app/account">Mon compte</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  void logout();
                }}
              >
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        {isAdmin ? (
          <nav className="border-t">
            <div className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 py-1">
              {adminNav.map((item) => {
                const active =
                  item.href === "/app/admin"
                    ? pathname === "/app/admin"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
        {isParent ? (
          <nav className="border-t">
            <div className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 py-1">
              {parentNav.map((item) => {
                const active =
                  item.href === "/app/parent"
                    ? pathname === "/app/parent"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
        {isTeacher ? (
          <nav className="border-t">
            <div className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 py-1">
              {teacherNav.map((item) => {
                const active =
                  item.href === "/app/teacher"
                    ? pathname === "/app/teacher" ||
                      pathname.startsWith("/app/teacher/attendance")
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
