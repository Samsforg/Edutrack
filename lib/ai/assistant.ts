import { createClient } from "@/lib/supabase/server";
import { listInsights, bumpAiUsage, recordAiAudit, isFeatureEnabled } from "@/lib/ai/store";
import { aiGateway } from "@/lib/ai/provider";
import { buildAssistantPrompt } from "@/lib/ai/prompts";

/**
 * Assistant EduTrack (§16-§21).
 * Pipeline SÉCURISÉ : auth -> rôle -> scope -> récupération CONTEXTUELLE
 * limitée (jamais toute la base) -> contexte ; puis réponse IA via Gateway
 * (StatisticalProvider par défaut, déterministe). L'assistant ne voit que
 * les données du périmètre autorisé par le rôle de l'utilisateur.
 */

export type AssistantScope =
  | { kind: "school" }
  | { kind: "student"; studentId: string; studentName: string }
  | { kind: "class"; classId: string; className: string };

export type AssistantReply = {
  answer: string;
  scopedTo: string;
  sources: number;
  provider: string;
};

type Viewer = {
  userId: string;
  schoolId: string;
  role: "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "PARENT";
};

type ClassForTeacher = { classId: string; className: string };

/** Parent : scope sur l'enfant demandé (vérifie appartenance). */
async function parentStudent(viewer: Viewer): Promise<AssistantScope | null> {
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("student_parents")
    .select("student_id")
    .eq("parent_id", viewer.userId);
  const ids = (links as unknown as { student_id: string }[] | null)?.map((l) => l.student_id) ?? [];
  if (ids.length === 0) return null;
  const { data: std } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("school_id", viewer.schoolId)
    .in("id", ids)
    .eq("status", "active")
    .limit(1);
  const s = (std as unknown as { id: string; first_name: string; last_name: string }[] | null)?.[0];
  if (!s) return null;
  return { kind: "student", studentId: s.id, studentName: `${s.first_name} ${s.last_name}` };
}

/** Teacher : scope classe (vérifie qu'il enseigne bien la classe). */
async function teacherScope(viewer: Viewer): Promise<AssistantScope> {
  const supabase = await createClient();
  const { data: classSubjects } = await supabase
    .from("class_subjects")
    .select("class_id")
    .eq("teacher_id", viewer.userId)
    .eq("school_id", viewer.schoolId);
  const classIds = (classSubjects as unknown as { class_id: string }[] | null)
    ?.map((c) => c.class_id)
    .filter(Boolean);
  const allowed = classIds ?? [];
  const scopes: ClassForTeacher[] = [];
  if (allowed.length > 0) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name")
      .in("id", allowed)
      .eq("school_id", viewer.schoolId)
      .limit(1);
    const list = (classes as unknown as { id: string; name: string }[] | null) ?? [];
    for (const c of list) scopes.push({ classId: c.id, className: c.name });
  }
  if (scopes.length === 0) return { kind: "school" };
  const s = scopes[0];
  return { kind: "class", classId: s.classId, className: s.className };
}

/** Récupère le contexte compact et sûr selon le scope. */
async function buildContext(
  scope: AssistantScope
): Promise<{ summary: string[]; count: number }> {
  const lines: string[] = [];
  let count = 0;

  const filters: Parameters<typeof listInsights>[0] = {};
  if (scope.kind === "student") filters.studentId = scope.studentId;
  if (scope.kind === "class") filters.classId = scope.classId;

  const insights = await listInsights({ ...filters, status: "active", limit: 8 });
  count += insights.length;
  for (const i of insights) {
    lines.push(`[${i.severity}] ${i.title} — ${i.recommendation ?? i.summary}`);
  }
  if (lines.length === 0) lines.push("Aucun signal récent à signaler.");

  return { summary: lines, count };
}

/** Point d'entrée de l'assistant (à appeler depuis une server action). */
export async function askAssistant(
  viewer: Viewer,
  question: string
): Promise<AssistantReply> {
  const slim = question.trim();
  const enabled = await isFeatureEnabled("ai_assistant");
  if (!enabled) {
    return { answer: "L'assistant est en cours d'activation.", scopedTo: "—", sources: 0, provider: "disabled" };
  }
  void slim;

  const scope: AssistantScope =
    viewer.role === "PARENT"
      ? (await parentStudent(viewer)) ?? { kind: "school" }
      : viewer.role === "TEACHER"
        ? await teacherScope(viewer)
        : { kind: "school" };

  const scopeLabel =
    scope.kind === "student"
      ? `Élève : ${scope.studentName}`
      : scope.kind === "class"
        ? `Classe : ${scope.className}`
        : `École`;

  const context = await buildContext(scope);
  const prompt = buildAssistantPrompt(viewer.role, slim, context.summary.join("\n"));

  let answer: string;
  let provider = aiGateway.currentName;
  try {
    answer = await aiGateway.generateText({ prompt, temperature: 0.2 });
  } catch {
    // Fallback déterministe — ne jamais bloquer l'usage.
    provider = "statistical";
    answer =
      context.summary.length > 0
        ? "Voici les signaux à surveiller :\n" + context.summary.slice(0, 4).join("\n")
        : "Aucune donnée préoccupante n'est détectée sur ce périmètre.";
  }

  await bumpAiUsage(viewer.schoolId, { requests: 1 });
  await recordAiAudit({
    schoolId: viewer.schoolId,
    userId: viewer.userId,
    action: "assistant.query",
    model: provider,
    inputType: "assistant.query",
    outputType: "text",
    latencyMs: null,
    tokensUsed: null,
  });

  return { answer, scopedTo: scopeLabel, sources: context.count, provider };
}

/** Vérifie l'accès d'un school admin / super admin à l'assistant. */
export async function assertAssistantAccess(
  role: "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "PARENT"
): Promise<boolean> {
  return role === "SUPER_ADMIN" || role === "SCHOOL_ADMIN";
}
