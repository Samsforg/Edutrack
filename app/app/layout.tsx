import { redirect } from "next/navigation";
import { getSession, roleHome } from "@/lib/auth/session";
import { AppShell } from "./app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AppShell
      user={{
        id: session.user.id,
        email: session.user.email ?? "",
        fullName:
          session.user.user_metadata?.full_name ?? session.user.email ?? "",
      }}
      memberships={session.memberships}
      homePath={roleHome(session.primaryRole ?? "PARENT")}
    >
      {children}
    </AppShell>
  );
}
