/**
 * Structured Logging — JSON vers stdout (capturé par Vercel/Datadog/Sentry).
 *
 * Ne JAMAIS logger : passwords, tokens, cookies, secrets, PII complète.
 * Hash user_id (premiers 8 chars) si nécessaire pour corrélation.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  requestId?: string;
  userId?: string;        // Hashé: premiers 8 chars
  schoolId?: string;
  route?: string;
  method?: string;
  durationMs?: number;
  statusCode?: number;
  error?: Error;
  [key: string]: unknown;
}

function hashId(id?: string): string | undefined {
  if (!id) return undefined;
  return id.length > 8 ? id.slice(0, 8) + "…" : id;
}

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitive = ["password", "token", "secret", "key", "authorization", "cookie", "session"];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const kl = k.toLowerCase();
    if (sensitive.some((s) => kl.includes(s))) {
      out[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null) {
      out[k] = sanitize(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function format(level: LogLevel, message: string, context: LogContext = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: sanitize({
      ...context,
      userId: hashId(context.userId),
    }),
  };
  // stdout = Vercel Logs / Datadog / Loki
  console[level === "debug" ? "log" : level](JSON.stringify(entry));
}

export const logger = {
  debug: (message: string, context?: LogContext) => format("debug", message, context),
  info: (message: string, context?: LogContext) => format("info", message, context),
  warn: (message: string, context?: LogContext) => format("warn", message, context),
  error: (message: string, context?: LogContext) => format("error", message, context),

  // Helpers métiers
  ai: (action: string, context: LogContext) => format("info", `AI:${action}`, context),
  auth: (action: string, context: LogContext) => format("info", `AUTH:${action}`, context),
  billing: (action: string, context: LogContext) => format("info", `BILLING:${action}`, context),
  db: (action: string, context: LogContext) => format("debug", `DB:${action}`, context),
  job: (action: string, context: LogContext) => format("info", `JOB:${action}`, context),
  notification: (action: string, context: LogContext) => format("info", `NOTIF:${action}`, context),
  security: (action: string, context: LogContext) => format("warn", `SECURITY:${action}`, context),
};