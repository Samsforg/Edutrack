# Changelog — EduTrack

Toutes les versions suivent [SemVer](https://semver.org/).

## [0.9.0] - 2025-09-03 — Phase 9: Production Hardening

### Added
- Middleware d'authentification global (`middleware.ts`) avec rafraîchissement session
- Rate limiting abstraction (`lib/security/rate-limit.ts`) avec helpers par route critique
- Observabilité complète : logger structuré, error tracking (Sentry-ready), métriques Prometheus
- Health checks : `/api/health` (liveness), `/api/ready` (readiness + DB), `/api/metrics` (Prometheus)
- Feature flags système (`lib/features/flags.ts`) avec cache React, rollout 5 niveaux
- Security headers CSP, HSTS, X-Frame-Options, Permissions-Policy dans `next.config.ts`
- Data integrity check script (`supabase/scripts/data-integrity-check.sql`) — 38 vérifications
- Documentation production : ENVIRONMENTS.md, BACKUP_RECOVERY.md, INCIDENT_RESPONSE.md, PHASE9_AUDIT.md
- CI/CD : workflows staging/production avec approval manuel

### Fixed
- Rate limiting sur routes critiques (auth, AI, imports, webhooks, admin)
- PWA service worker durci (pas de cache données privées)
- Security headers pour production (CSP, HSTS, X-Frame-Options, etc.)
- Observabilité : plus de `console.log` brut, logs structurés JSON

### Security
- Rate limiting sur toutes routes sensibles
- CSP strict en production
- HSTS activé en production
- Pas de secrets dans logs/erreurs (sanitization)

---

## [0.8.0] - 2025-09-02 — Phase 8: Intelligence & Automatisation

### Added
- Module `lib/ai/` complet : Risk Engine statistique (40/30/20/10), AI Gateway, providers (Statistical, Mock, LLM stub)
- Détection insights : 8 types (attendance_risk, performance_drop, positive_trend, etc.) + déduplication 24h
- Assistant sécurisé `/app/admin/assistant` : auth → rôle → scope → data filtering → AI
- Résumés élève/classe validés Zod, weekly digest par rôle
- Jobs asynchrones : `ai_job_queue` (PGMQ-style), détection, nettoyage, weekly digest
- Notifications intelligentes : 6 nouveaux types + priorité (critical/high/normal/low)
- Communications abstraction : SMS/WhatsApp (no-op par défaut, opt-in)
- RLS complet sur 7 nouvelles tables (ai_insights, ai_audit_logs, ai_usage, etc.)
- Feature flags DB (5 niveaux rollout) + quotas IA par plan
- Super-admin `/app/super-admin/ai` : flags globaux, usage, jobs, insights globaux
- Pages : `/app/admin/insights`, `/app/admin/assistant`, `/app/admin/ai`, `/app/teacher/insights`, `/app/parent/children/[id]/insights`, `/app/app/account` (préférences comm)
- Tests unitaires AI : risk config, engine, detection, providers (4 fichiers, 57 tests)
- Documentation : 8 fichiers `docs/AI*.md`, `COMMUNICATIONS.md`, `AUTOMATION.md`, `SCALE.md`, `future_scale.md`

### Database
- Migration 0018 : 7 nouvelles tables, enums, RLS, indexes, feature flags seed

---

## [0.7.0] - 2025-09-01 — Phase 7: Billing & Subscriptions

### Added
- Abonnements : plans (Starter/Standard/Pro), trials 14j, statuts, entitlements
- Webhook billing idempotent (signature, doublons)
- Server-side entitlements (`lib/billing/entitlements.ts`) + garde-fou `assertCanWrite`
- UI facturation : `/school/billing` (Starter trial, upgrade, annulation)
- Super-admin leads : `/super-admin/leads` (CRUD, statuts, conversion)
- Notifications billing (trial ending, payment failed, renewal)
- Seed démo avec abonnement Starter trial 14j

---

## [0.6.0] - 2025-08-31 — Phase 6: Imports, Analytics, Rapports

### Added
- Import CSV : wizard multi-étapes, validation, job asynchrone, journal `import_jobs`
- Analytics : KPIs école, tendances assiduité 30j, moyennes par matière/classe, vues `SECURITY INVOKER`
- Rapports : exports CSV (élèves, présences, notes, analytiques), anti-injection CSV
- RLS durci imports/analytics/rapports (admin guard `is_admin_of_school`)

---

## [0.5.0] - 2025-08-30 — Phase 5: Pédagogie Avancée

### Added
- Périodes académiques (trimestres/semestres), évaluations, notes structurées
- Publication notes + notifications parents
- Onglet "Évaluations" professeur + saisie par grille
- Rapports académiques (par matière, par classe)

---

## [0.4.0] - 2025-08-29 — Phase 4: Temps Réel & Notifications

### Added
- Présence temps réel (Supabase Realtime + broadcast)
- Notifications in-app + temps réel (bell, liste, marquage lu)
- Annonces (audience all/class/parents) + publications
- Liaison parent-enfant sécurisée (codes, demandes, approbation)

---

## [0.3.0] - 2025-08-28 — Phase 3: Présences & Notes Core

### Added
- Présences : saisie par classe/date, statuts (present/absent/late/excused), historique
- Notes : saisie, coefficients, publication, moyennes
- RLS complet présences/notes (teacher → ses classes, parent → ses enfants)

---

## [0.2.0] - 2025-08-27 — Phase 2: Multi-Tenant & RBAC

### Added
- Multi-tenant : écoles, membres, rôles (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, PARENT)
- RLS helper functions (`is_school_member`, `is_admin_of_school`, `parent_of_student`, `user_teaches_class`)
- Onboarding école : création, admin, code, invitation
- Super-admin : liste écoles, création, suspension

---

## [0.1.0] - 2025-08-26 — Phase 1: Fondation

### Added
- Next.js 16 + Supabase + TypeScript + Tailwind + shadcn/ui
- Auth Supabase (email/password, email confirm, session SSR)
- Schéma DB core : schools, profiles, school_members, academic_years, classes, students, teachers, subjects
- Seed démo déterministe
- CI baseline (lint, typecheck, test, build)