import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { roleHome } from "@/lib/auth/session";

export default async function SchoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  void session;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Link href={roleHome(session.primaryRole ?? "SCHOOL_ADMIN")} className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              E
            </span>
            <span className="font-bold">EduTrack</span>
          </Link>
          <Link
            href={roleHome(session.primaryRole ?? "SCHOOL_ADMIN")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Retour à l&apos;application
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
