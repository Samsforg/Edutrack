import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const checks: Record<string, { status: "ok" | "fail"; latencyMs?: number; error?: string }> = {};
  let allOk = true;

  // 1. Database connectivity
  const dbStart = Date.now();
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await supabase.from("schools").select("id").limit(1);
    if (error) throw error;
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (e) {
    allOk = false;
    checks.database = { status: "fail", latencyMs: Date.now() - dbStart, error: (e as Error).message };
  }

  // 2. Critical tables accessible (sample)
  const tables = ["schools", "profiles", "school_members", "students"];
  for (const table of tables) {
    const tStart = Date.now();
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error } = await supabase.from(table).select("id").limit(1);
      if (error) throw error;
      checks[`table_${table}`] = { status: "ok", latencyMs: Date.now() - tStart };
    } catch (e) {
      allOk = false;
      checks[`table_${table}`] = { status: "fail", latencyMs: Date.now() - tStart, error: (e as Error).message };
    }
  }

  // 3. Auth service (Supabase Auth)
  const authStart = Date.now();
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.getSession();
    checks.auth = { status: "ok", latencyMs: Date.now() - authStart };
  } catch (e) {
    allOk = false;
    checks.auth = { status: "fail", latencyMs: Date.now() - authStart, error: (e as Error).message };
  }

  const status = allOk ? 200 : 503;
  return NextResponse.json(
    {
      status: allOk ? "ready" : "not_ready",
      version: process.env.npm_package_version ?? "0.1.0",
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status }
  );
}