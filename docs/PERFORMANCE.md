# Performance — EduTrack

## Objectifs (Core Web Vitals)

| Métrique | Cible | Critique |
|----------|-------|----------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Oui |
| **INP** (Interaction to Next Paint) | < 200ms | Oui |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Oui |
| **TTFB** (Time to First Byte) | < 600ms | Oui |
| **FCP** (First Contentful Paint) | < 1.8s | Non |
| **TBT** (Total Blocking Time) | < 200ms | Non |

## Budgets

| Ressource | Budget | Outil |
|-----------|--------|-------|
| JS Total (gzipped) | < 250 KB | `next build` + `webpack-bundle-analyzer` |
| CSS Total (gzipped) | < 50 KB | idem |
| Images (hero) | < 100 KB | `next/image` + AVIF/WebP |
| Fonts | < 50 KB | `next/font` (Geist, subset latin) |
| API Response (p95) | < 500ms | Vercel Analytics / custom metrics |

---

## Optimisations Next.js

### 1. Bundle Size
```bash
# Analyser
npx @next/bundle-analyzer

# Optimisations activées dans next.config.ts
experimental: {
  optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
}
```

### 2. Images
- `next/image` obligatoire pour toutes images
- Formats : AVIF → WebP → fallback
- `sizes` prop sur images responsives
- `priority` sur hero/above-fold
- `placeholder="blur"` + `blurDataURL` pour LCP

### 3. Fonts
```tsx
// app/layout.tsx
const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" });
// Subsetting latin uniquement (~30KB vs 150KB full)
```

### 4. Code Splitting
- Dynamic imports pour composants lourds (charts, editors, AI chat)
- `next/dynamic` avec `ssr: false` pour client-only

### 5. Caching
| Route | Stratégie |
|-------|-----------|
| `/` (landing) | Static (ISR 1h) |
| `/login`, `/signup` | Static |
| `/app/*` (dashboards) | Dynamic (no cache) + `cache()` React sur `getSession` |
| `/api/health` | No cache |
| `/api/ready` | No cache |
| `/api/metrics` | No cache |
| Static assets | `Cache-Control: public, max-age=31536000, immutable` |

---

## Base de Données

### Index Critiques (vérifier `EXPLAIN ANALYZE`)
```sql
-- Tables core
CREATE INDEX ON students (school_id, classroom_id);
CREATE INDEX ON attendance (student_id, attendance_date);
CREATE INDEX ON grades (student_id, assessment_id);
CREATE INDEX ON grades (classroom_id, assessment_id);
CREATE INDEX ON school_members (user_id, school_id);
CREATE INDEX ON notifications (user_id, read_at);

-- Phase 8 AI
CREATE INDEX ON ai_insights (school_id, status);
CREATE INDEX ON ai_insights (school_id, severity DESC);
CREATE INDEX ON ai_insights (dedup_key);
CREATE INDEX ON ai_job_queue (status, run_at);

-- Billing
CREATE INDEX ON school_subscriptions (school_id, status);
```

### Requêtes Optimisées
- **Sélection colonne par colonne** : jamais `SELECT *`
- **Pagination** : `limit` + `range` (Supabase) ou cursor
- **Batch inserts** : `upsert` avec `onConflict` pour attendance/grades
- **RLS-friendly** : `school_id` résolu côté serveur, jamais depuis client

### N+1 Prevention
- `getSession()` cached via `cache()` React (1 appel/requête)
- `getSchoolSubscriptionCached()` cached
- Préfetch données critiques dans Server Components parents

---

## Mobile / 3G / Low-End

### Checklist
- [ ] Test Chrome DevTools : Network → Slow 3G
- [ ] Test Lighthouse Mobile : Performance > 90
- [ ] Pas de tableaux horizontaux scroll sur < 375px
- [ ] Boutons ≥ 44x44px (touch target)
- [ ] Modales ≤ 90vw, fermables swipe-down
- [ ] Graphiques : version simplifiée mobile (sparkline vs full chart)
- [ ] Formulaires : `inputmode`, `autocomplete`, labels visibles

### Optimisations Spécifiques
```tsx
// Table responsive → Cards sur mobile
{isMobile ? (
  <CardList items={data} />
) : (
  <Table data={data} />
)}

// Charts : recharts → responsiveContainer + mobile config
<ResponsiveContainer width="100%" height={isMobile ? 200 : 400}>
  <LineChart data={data}>
    <Line strokeWidth={isMobile ? 1 : 2} dot={false} />
  </LineChart>
</ResponsiveContainer>
```

---

## Monitoring Performance

### Métriques Clés (Vercel Analytics + Custom)
```typescript
// lib/observability/metrics.ts
httpRequest: (method, route, status, durationMs) => { ... }
dbQuery: (table, operation, durationMs, schoolId) => { ... }
aiLatency: (provider, action, latencyMs, schoolId) => { ... }
```

### Alertes (Sentry / Vercel)
| Métrique | Seuil | Action |
|----------|-------|--------|
| Error rate | > 1% / 5min | Page on-call |
| P95 latency | > 2s / 5min | Page on-call |
| DB CPU | > 80% / 10min | Scale / optimize |
| AI fallback rate | > 10% | Investigate provider |

---

## Load Testing

### Scénarios (k6 / Artillery)
```yaml
# k6 script exemple
scenarios:
  login_dashboard:
    executor: ramping-vus
    stages:
      - duration: 2m, target: 50
      - duration: 5m, target: 100
      - duration: 2m, target: 200
    exec: login_then_dashboard
```

### Cibles
| Utilisateurs simultanés | Latence P95 | Error Rate |
|-------------------------|-------------|------------|
| 100 | < 500ms | < 0.1% |
| 500 | < 1s | < 0.5% |
| 1000 | < 2s | < 1% |

**Exécution** : Sur Staging uniquement (jamais Prod direct)

---

## Checklist Release Performance

- [ ] `npm run build` → bundle analyzer < 250KB JS
- [ ] Lighthouse Mobile (Staging) > 90
- [ ] Lighthouse Desktop (Staging) > 95
- [ ] k6 load test 100 VUs → P95 < 500ms, error rate < 0.1%
- [ ] `EXPLAIN ANALYZE` sur 10 requêtes les plus lentes
- [ ] Pas de `SELECT *` dans nouveau code
- [ ] Pas de N+1 dans nouveaux Server Components
- [ ] Images optimisées (AVIF/WebP, sizes, priority)
- [ ] Fonts subset latin seulement