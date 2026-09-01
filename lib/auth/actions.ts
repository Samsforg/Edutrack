"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession, roleHome } from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export type LoginResult =
  | { error: string }
  | { ok: true; redirectTo: string };

export async function login(_prev: unknown, formData: FormData): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Données invalides" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.message?.toLowerCase().includes("invalid login")) {
      return { error: "Email ou mot de passe incorrect" };
    }
    return { error: error.message };
  }

  const session = await getSession();
  const redirectTo = session?.primaryRole
    ? roleHome(session.primaryRole)
    : "/login";

  return { ok: true, redirectTo };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const signupSchema = z.object({
  fullName: z.string().min(2, "Nom complet requis"),
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export type SignupResult =
  | { error: string }
  | { ok: true; message: string };

export async function signup(
  _prev: unknown,
  formData: FormData
): Promise<SignupResult> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Données invalides" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return {
    ok: true,
    message:
      "Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse avant de vous connecter.",
  };
}
