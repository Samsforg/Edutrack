import { redirect } from "next/navigation";
import { getSession, roleHome } from "@/lib/auth/session";

export default async function AppIndex() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  if (!session.primaryRole) {
    // Authenticated but with no school membership yet.
    redirect("/app/welcome");
  }
  redirect(roleHome(session.primaryRole));
}
