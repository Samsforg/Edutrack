/**
 * Rate Limiting — Abstraction mémoire (dev) / Redis (prod).
 *
 * En production, remplacer par Upstash Redis / Vercel KV pour persistance
 * multi-instance. Ici : Map en mémoire pour dev/staging single-instance.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type RateLimitKey = {
  identifier: string;      // IP, user_id, school_id, ou composite
  route: string;           // ex: "/api/auth/login", "ai.assistant"
  windowMs: number;        // Fenêtre glissante en ms
  maxRequests: number;     // Max requêtes par fenêtre
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;         // Unix ms quand le quota se réinitialise
  retryAfterMs?: number;   // Si bloqué, ms avant réessai
};

// Stockage en mémoire (remplacer par Redis en prod multi-instance)
const store = new Map<string, { count: number; windowStart: number }>();

function getKey(k: RateLimitKey): string {
  return `${k.route}:${k.identifier}`;
}

function nowMs(): number {
  return Date.now();
}

export function checkRateLimit(input: RateLimitKey): RateLimitResult {
  const key = getKey(input);
  const now = nowMs();
  const windowStart = now - input.windowMs;

  const entry = store.get(key);
  if (!entry || entry.windowStart < windowStart) {
    // Nouvelle fenêtre
    store.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: input.maxRequests - 1,
      resetAt: now + input.windowMs,
    };
  }

  if (entry.count >= input.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + input.windowMs,
      retryAfterMs: entry.windowStart + input.windowMs - now,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: input.maxRequests - entry.count,
    resetAt: entry.windowStart + input.windowMs,
  };
}

export function resetRateLimit(identifier: string, route: string): void {
  store.delete(`${route}:${identifier}`);
}

/**
 * Helpers pour routes critiques
 */
export const RATE_LIMITS = {
  // Auth
  login: (ip: string) => checkRateLimit({ identifier: ip, route: "auth.login", windowMs: 15 * 60 * 1000, maxRequests: 5 }),
  register: (ip: string) => checkRateLimit({ identifier: ip, route: "auth.register", windowMs: 60 * 60 * 1000, maxRequests: 3 }),
  forgotPassword: (ip: string) => checkRateLimit({ identifier: ip, route: "auth.forgot", windowMs: 60 * 60 * 1000, maxRequests: 3 }),

  // AI (Phase 8)
  aiAssistant: (schoolId: string) => checkRateLimit({ identifier: schoolId, route: "ai.assistant", windowMs: 60 * 1000, maxRequests: 10 }),
  aiGeneration: (schoolId: string) => checkRateLimit({ identifier: schoolId, route: "ai.generate", windowMs: 60 * 1000, maxRequests: 20 }),

  // Notifications
  sendNotification: (schoolId: string) => checkRateLimit({ identifier: schoolId, route: "notify.send", windowMs: 60 * 1000, maxRequests: 30 }),

  // Imports/Exports
  import: (schoolId: string) => checkRateLimit({ identifier: schoolId, route: "import", windowMs: 60 * 60 * 1000, maxRequests: 10 }),
  export: (schoolId: string) => checkRateLimit({ identifier: schoolId, route: "export", windowMs: 60 * 60 * 1000, maxRequests: 20 }),

  // Webhooks
  billingWebhook: (ip: string) => checkRateLimit({ identifier: ip, route: "webhook.billing", windowMs: 60 * 1000, maxRequests: 100 }),

  // Admin actions
  adminWrite: (schoolId: string) => checkRateLimit({ identifier: schoolId, route: "admin.write", windowMs: 60 * 1000, maxRequests: 50 }),

  // Student linking
  linkRequest: (ip: string) => checkRateLimit({ identifier: ip, route: "link.request", windowMs: 60 * 60 * 1000, maxRequests: 5 }),
} as const;

/**
 * Middleware helper pour Next.js API routes
 */
export function createRateLimitMiddleware(
  limiter: (identifier: string) => RateLimitResult
) {
  return async function rateLimitMiddleware(
    request: NextRequest,
    getIdentifier: (req: NextRequest) => string
  ) {
    const identifier = getIdentifier(request);
    const result = limiter(identifier);

    const headers = new Headers();
    headers.set("X-RateLimit-Remaining", String(result.remaining));
    headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      headers.set("Retry-After", String(Math.ceil((result.retryAfterMs ?? 0) / 1000)));
      return new NextResponse(
        JSON.stringify({ error: "Trop de requêtes. Réessayez plus tard." }),
        { status: 429, headers }
      );
    }

    return null; // Continue
  };
}