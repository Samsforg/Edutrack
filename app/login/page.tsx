import { redirect } from "next/navigation";
import { getSession, roleHome } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session?.primaryRole) {
    redirect(roleHome(session.primaryRole));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <LoginForm />
    </div>
  );
}
