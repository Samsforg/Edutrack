/**
 * Error Tracking — Abstraction Sentry / fallback logger.
 *
 * Version simplifiée sans dépendance obligatoire.
 * Si Sentry nécessaire: `npm install @sentry/nextjs` + adapter ce fichier.
 */

interface ErrorContext {
  requestId?: string;
  userId?: string;
  schoolId?: string;
  route?: string;
  action?: string;
  [key: string]: unknown;
}

function hashId(id?: string): string | undefined {
  if (!id) return undefined;
  return id.length > 8 ? id.slice(0, 8) + "…" : id;
}

function sanitizeContext(ctx: ErrorContext): ErrorContext {
  const out: ErrorContext = { ...ctx };
  if (out.userId) out.userId = hashId(out.userId);
  delete (out as Record<string, unknown>).password;
  delete (out as Record<string, unknown>).token;
  delete (out as Record<string, unknown>).secret;
  delete (out as Record<string, unknown>).authorization;
  return out;
}

/**
 * Fallback logger - utilise le logger structuré
 */
async function logError(error: Error, context?: ErrorContext): Promise<void> {
  const { logger } = await import("@/lib/observability/logger");
  logger.error(error.message, { ...sanitizeContext(context ?? {}), error });
}

async function logMessage(message: string, level: "info" | "warning" | "error", context?: ErrorContext): Promise<void> {
  const { logger } = await import("@/lib/observability/logger");
  logger[level === "error" ? "error" : level === "warning" ? "warn" : "info"](message, sanitizeContext(context ?? {}));
}

/**
 * Capture une exception avec contexte sanitisée
 */
export async function captureException(error: Error, context?: ErrorContext): Promise<void> {
  await logError(error, context);
}

/**
 * Capture un message (non-exception) avec niveau
 */
export async function captureMessage(message: string, level: "info" | "warning" | "error" = "info", context?: ErrorContext): Promise<void> {
  await logMessage(message, level, context);
}

/**
 * Définit un contexte nommé (noop dans cette version)
 */
export async function setContext(_name: string, _ctx: Record<string, unknown>): Promise<void> {
  // noop - utiliser le logger pour le contexte
}

/**
 * Helper pour capturer erreurs dans Server Actions
 */
export async function captureServerActionError(
  action: string,
  error: unknown,
  context?: { userId?: string; schoolId?: string; route?: string }
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  await captureException(err, {
    action,
    route: context?.route,
    userId: context?.userId,
    schoolId: context?.schoolId,
  });
}

/**
 * Helper pour capturer erreurs dans API Routes
 */
export async function captureApiError(
  route: string,
  error: unknown,
  context?: { userId?: string; schoolId?: string; method?: string; statusCode?: number }
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  await captureException(err, {
    action: "api_error",
    route,
    userId: context?.userId,
    schoolId: context?.schoolId,
    method: context?.method,
    statusCode: context?.statusCode,
  });
}