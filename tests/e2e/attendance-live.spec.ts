import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { loginAs } from "./helpers";

/**
 * Realtime « présence » : le badge du parent se met à jour en direct (sans
 * rechargement) quand l'enseignant enregistre la présence (§43). On injecte
 * l'écriture via le service role, puis on vérifie que la page parent a bien
 * réagi via Postgres Changes (RLS-parent).
 */
function loadEnv() {
  const envFile = path.resolve(process.cwd(), ".env.local");
  const out: Record<string, string> = {};
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  }
  return out;
}

test.describe("Realtime présence", () => {
  test("le widget aujourd'hui du parent se met à jour en direct (§43)", async ({
    page,
  }) => {
    const env = loadEnv();
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = env.SUPABASE_SERVICE_ROLE_KEY;
    expect(url && anon && service, "vars supabase requises").toBeTruthy();

    const adminClient = createClient(url, service, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find a DEMO student linked to parent1@demo.edutrack.
    const { data: parentRow } = await adminClient
      .from("parents")
      .select("id")
      .eq("school_id", (await adminClient.from("schools").select("id").eq("code", "DEMO").maybeSingle()).data?.id)
      .eq("user_id", (
        await adminClient.auth.admin.listUsers()
      ).data.users.find((u) => u.email === "parent1@demo.edutrack")?.id)
      .maybeSingle();
    expect(parentRow, "parent1 doit exister (seed)").toBeTruthy();

    const { data: link } = await adminClient
      .from("student_parents")
      .select("student_id")
      .eq("parent_id", parentRow!.id)
      .limit(1)
      .maybeSingle();
    expect(link, "parent1 doit être lié à un élève").toBeTruthy();
    const studentId = link!.student_id;

    const { data: student } = await adminClient
      .from("students")
      .select("id, school_id, classroom_id")
      .eq("id", studentId)
      .single();
    expect(student).toBeTruthy();

    // Ensure no attendance exists today for that student, then open the portal.
    const today = new Date().toISOString().slice(0, 10);
    await adminClient
      .from("attendance")
      .delete()
      .eq("student_id", studentId)
      .eq("attendance_date", today);

    await loginAs(page, "parent");
    await expect(page.getByRole("heading", { name: "Mes enfants" })).toBeVisible();
    // The "Aujourd'hui" section shows the live widget.
    await expect(page.getByText("Pas encore pointé").first()).toBeVisible({ timeout: 15_000 });

    // Insert attendance via the service role (as if a teacher had made the call).
    await adminClient.from("attendance").insert({
      school_id: student!.school_id,
      student_id: studentId,
      classroom_id: student!.classroom_id,
      attendance_date: today,
      status: "present",
    });

    // Real-time: the badge flips to "Présent" without a page reload.
    await expect(
      page.getByText("Présent", { exact: true }).first()
    ).toBeVisible({ timeout: 20_000 });

    await adminClient
      .from("attendance")
      .delete()
      .eq("student_id", studentId)
      .eq("attendance_date", today);
  });
});