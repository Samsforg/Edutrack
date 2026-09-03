/**
 * Metrics — Compteurs simples en mémoire (dev) / Prometheus (prod).
 *
 * En production, exporter vers Prometheus / Vercel Analytics / Datadog.
 */

type MetricType = "counter" | "gauge" | "histogram";

interface Metric {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

interface HistogramMetric extends Metric {
  values: number[];
}

const metrics = new Map<string, Metric | HistogramMetric>();

function metricKey(name: string, labels: Record<string, string>): string {
  const labelStr = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
  return `${name}{${labelStr}}`;
}

export function incrementCounter(
  name: string,
  labels: Record<string, string> = {},
  value = 1
): void {
  const key = metricKey(name, labels);
  const existing = metrics.get(key);
  metrics.set(key, {
    name,
    type: "counter",
    value: (existing?.value ?? 0) + value,
    labels,
    timestamp: Date.now(),
  });
}

export function setGauge(
  name: string,
  value: number,
  labels: Record<string, string> = {}
): void {
  const key = metricKey(name, labels);
  metrics.set(key, {
    name,
    type: "gauge",
    value,
    labels,
    timestamp: Date.now(),
  });
}

export function observeHistogram(
  name: string,
  value: number,
  labels: Record<string, string> = {}
): void {
  const key = metricKey(name, labels);
  const existing = metrics.get(key);
  const values = (existing as HistogramMetric)?.values ?? [];
  values.push(value);
  // Garder seulement les 1000 dernières valeurs
  if (values.length > 1000) values.shift();
  metrics.set(key, {
    name,
    type: "histogram",
    value: values.reduce((a, b) => a + b, 0) / values.length, // Moyenne courante
    labels,
    timestamp: Date.now(),
  });
  // Stocker les valeurs brutes pour percentile
  (metrics.get(key) as HistogramMetric).values = values;
}

/**
 * Helpers métier
 */
export const metricsHelpers = {
  // Auth
  loginSuccess: (method: "email" | "oauth") => incrementCounter("auth_login_success_total", { method }),
  loginFailure: (method: "email" | "oauth", reason: string) => incrementCounter("auth_login_failure_total", { method, reason }),
  logout: () => incrementCounter("auth_logout_total", {}),

  // AI (Phase 8)
  aiRequest: (provider: "statistical" | "llm" | "mock", action: string, schoolId: string) =>
    incrementCounter("ai_request_total", { provider, action, school_id: schoolId.slice(0, 8) }),
  aiFallback: (fromProvider: string, schoolId: string) =>
    incrementCounter("ai_fallback_total", { from_provider: fromProvider, school_id: schoolId.slice(0, 8) }),
  aiLatency: (provider: string, action: string, latencyMs: number, schoolId: string) =>
    observeHistogram("ai_latency_ms", latencyMs, { provider, action, school_id: schoolId.slice(0, 8) }),
  aiQuotaExceeded: (schoolId: string) =>
    incrementCounter("ai_quota_exceeded_total", { school_id: schoolId.slice(0, 8) }),

  // Attendance
  attendanceRecorded: (schoolId: string, count: number) =>
    incrementCounter("attendance_recorded_total", { school_id: schoolId.slice(0, 8) }, count),

  // Grades
  gradesPublished: (schoolId: string, count: number) =>
    incrementCounter("grades_published_total", { school_id: schoolId.slice(0, 8) }, count),

  // Notifications
  notificationSent: (type: string, channel: "in_app" | "email" | "sms" | "whatsapp", schoolId: string) =>
    incrementCounter("notification_sent_total", { type, channel, school_id: schoolId.slice(0, 8) }),
  notificationFailed: (type: string, channel: string, schoolId: string) =>
    incrementCounter("notification_failed_total", { type, channel, school_id: schoolId.slice(0, 8) }),

  // Billing
  billingWebhookReceived: (provider: string, event: string) =>
    incrementCounter("billing_webhook_received_total", { provider, event }),
  billingWebhookFailed: (provider: string, reason: string) =>
    incrementCounter("billing_webhook_failed_total", { provider, reason }),

  // Jobs
  jobStarted: (jobType: string, schoolId: string | null) =>
    incrementCounter("job_started_total", { job_type: jobType, school_id: schoolId?.slice(0, 8) ?? "global" }),
  jobCompleted: (jobType: string, schoolId: string | null) =>
    incrementCounter("job_completed_total", { job_type: jobType, school_id: schoolId?.slice(0, 8) ?? "global" }),
  jobFailed: (jobType: string, schoolId: string | null, error: string) =>
    incrementCounter("job_failed_total", { job_type: jobType, school_id: schoolId?.slice(0, 8) ?? "global", error }),

  // HTTP
  httpRequest: (method: string, route: string, statusCode: number) => {
    incrementCounter("http_requests_total", { method, route, status: String(statusCode) });
  },

  // Database
  dbQuery: (table: string, operation: "select" | "insert" | "update" | "delete", schoolId?: string) => {
    incrementCounter("db_query_total", { table, operation, school_id: schoolId?.slice(0, 8) ?? "global" });
  },

  // Errors
  error: (type: string, route?: string) =>
    incrementCounter("errors_total", { type, route: route ?? "unknown" }),
};

/**
 * Export au format Prometheus (pour /metrics endpoint)
 */
export function exportPrometheus(): string {
  const lines: string[] = [];
  for (const [, m] of metrics) {
    const labelStr = Object.entries(m.labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
    lines.push(`# TYPE ${m.name} ${m.type}`);
    lines.push(`${m.name}{${labelStr}} ${m.value} ${m.timestamp}`);
  }
  return lines.join("\n");
}

/**
 * Reset (pour tests)
 */
export function resetMetrics(): void {
  metrics.clear();
}