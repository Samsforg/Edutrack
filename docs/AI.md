# Intelligence EduTrack (Phase 8)

Ce document décrit l'architecture IA d'EduTrack, conçue pour être **100 % locale, déterministe, multi-tenant et sans dépendance externe obligatoire**.

## Vision

- **Statistique d'abord** : le moteur de risque (Risk Engine) calcule des scores sans LLM. Un fournisseur LLM est optionnel et isolé derrière un Gateway.
- **Sécurité par conception** : données jamais sorties du périmètre RLS, aucune donnée personnelle brute dans les logs d'audit.
- **Fallback garanti** : si le provider LLM est down, le StatisticalProvider prend le relais — aucune fonctionnalité core (présence, notes, annonces, auth, billing) ne bloque.

## Composants

| Module | Rôle |
|--------|------|
| `lib/ai/types.ts` | Types centraux (insights, risk, quotas, feature flags) |
| `lib/ai/risk/config.ts` | Coefficients & seuils (source de vérité unique) |
| `lib/ai/risk/engine.ts` | Calcul de score pur (pas d'I/O) |
| `lib/ai/risk/detect.ts` | Détection d'insights avec déduplication |
| `lib/ai/data.ts` | Agrégation présence/notes côté serveur (RLS) |
| `lib/ai/providers/` | StatisticalProvider (défaut), MockProvider (tests), LLMProvider (stub) |
| `lib/ai/provider.ts` | AI Gateway (`generateText`, `generateStructured`, `generateSummary`) |
| `lib/ai/schemas.ts` | Zod schemas (StudentSummary, ClassSummary, WeeklyDigest) |
| `lib/ai/store.ts` | CRUD insights, usage, audit, feature flags, comm prefs |
| `lib/ai/summaries/` | Génération résumés élève/classe (validés Zod) |
| `lib/ai/prompts/` | Prompts FR-only, données interdites, format JSON |
| `lib/ai/assistant.ts` | Pipeline sécurisé assistant (auth → rôle → scope → data → context → IA) |
| `lib/ai/jobs/` | Détection asynchrone, file de jobs, nettoyage, digest hebdo |
| `lib/communications/` | Abstraction SMS/WhatsApp (no-op par défaut) |

## Tables (migration 0018)

- `ai_insights` — insights multi-tenant (8 types, 5 sévérités, 4 statuts, `dedup_key`, `expires_at`)
- `ai_audit_logs` — audit appels IA (métadonnées seulement)
- `ai_usage` — quotas par école (requests/jour/mois, summaries, insights, tokens)
- `communication_preferences` — consentement canaux (SMS, WhatsApp, email, push)
- `feature_flags` — rollout 5 niveaux (disabled, internal, pilot, beta, enabled)
- `knowledge_documents` — RAG optionnel (embedding + HNSW si pgvector)
- `ai_job_queue` — file jobs durable (PGMQ-style simplifiée)

## RLS

Toutes les tables activent RLS. Politiques :
- **ai_insights** : parent → enfants, teacher → classes, admin → école, superadmin → tout
- **feature_flags** : lecture globale, admin école lit/écrit ses flags
- **knowledge_documents** : global (school_id null) lisible par tout membre, école privée = membre école
- **ai_job_queue** : service role only, superadmin lecture

## Quotas (par plan)

| Plan | requests/mois | insights | summaries | assistant |
|------|---------------|----------|-----------|-----------|
| starter | 200 | ✅ | ❌ | ❌ |
| standard | 1 000 | ✅ | ✅ | ✅ |
| pro | 5 000 | ✅ | ✅ | ✅ |

## Pages ajoutées

- `/app/admin/insights` — liste insights avec actions (acknowledged/resolved/dismissed)
- `/app/admin/assistant` — chat assistant (périmètre école)
- `/app/admin/ai` — quotas + lancement analyses manuelles
- `/app/teacher/insights` — signaux par classe (read-only)
- `/app/parent/children/[id]/insights` — signaux enfant
- `/app/super-admin/ai` — flags globaux, usage, jobs, insights globaux
- `/app/app/account` — préférences communication (email/push/SMS/WhatsApp)

## Sécurité assistant

1. Auth (session)
2. Rôle (SCHOOL_ADMIN / SUPER_ADMIN / TEACHER / PARENT)
3. Scope résolu (école / élève / classe) selon rôle
4. Récupération contextuelle limitée (insights actifs max 8)
5. Prompt construit côté serveur (règles FR, données interdites)
6. Appel Gateway (StatisticalProvider par défaut)
7. Audit + bump usage

## Tests

- `tests/unit/ai-risk-config.test.ts` — config coefficients/seuils
- `tests/unit/ai-engine.test.ts` — engine pur (score, sévérité, recommandations)
- `tests/unit/ai-detect.test.ts` — détection + déduplication
- `tests/unit/ai-providers.test.ts` — StatisticalProvider / MockProvider déterministes

## Déploiement

```bash
# Migration live
node apply-migration.mjs supabase/migrations/20250401000018_ai_insights.sql 20250401000018 ai_insights

# Build + test
npm run build && npm run test && npm run lint
```

## Conformité spéc Phase 8

- ✅ §2-§7 : module lib/ai complet
- ✅ §8-§9 : risk engine statistique expliquable (40/30/20/10)
- ✅ §10-§12 : détection élève/classe + déduplication
- ✅ §13-§15 : AI Gateway + providers + fallback
- ✅ §16-§21 : assistant sécurisé `/school/assistant`
- ✅ §22-§25 : résumés élève/classe Zod-validés
- ✅ §26 : notifications intelligentes (priorité + nouveaux types)
- ✅ §27-§28 : abstraction communications (SMS/WhatsApp)
- ✅ §29-§30 : weekly digest par rôle
- ✅ §31-§35 : RLS multi-tenant, feature flags 5 niveaux, quotas
- ✅ §36-§40 : super admin `/super-admin/ai`
- ✅ §41-§43 : tests déterministes (mock provider)
- ✅ §44-§47 : docs + rapport
- ✅ §48-§50 : migration 0018 live + commits + rapport final