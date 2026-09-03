# Scaling — EduTrack IA (Phase 8)

## Cibles Phase 8

| Métrique | Cible | Stratégie |
|----------|-------|-----------|
| Écoles | 100+ | Multi-tenant RLS, index par school_id |
| Élèves/école | 2 000 | Pagination, index composés |
| Insights/jour | 50 000 | Batch inserts, déduplication |
| Jobs quotidiens | 1 000 | Queue polling, max 10/worker |
| Requêtes assistant | 10 000/j | StatisticalProvider (0 latence LLM) |

## Base de données

### Index critiques

```sql
-- ai_insights
CREATE INDEX idx_ai_insights_school_status ON ai_insights (school_id, status);
CREATE INDEX idx_ai_insights_school_severity ON ai_insights (school_id, severity DESC);
CREATE INDEX idx_ai_insights_student ON ai_insights (student_id);
CREATE INDEX idx_ai_insights_class ON ai_insights (class_id);
CREATE INDEX idx_ai_insights_dedup ON ai_insights (dedup_key);
CREATE INDEX idx_ai_insights_expires ON ai_insights (expires_at);

-- ai_job_queue
CREATE INDEX idx_ai_job_queue_status_run ON ai_job_queue (status, run_at);
CREATE INDEX idx_ai_job_queue_school ON ai_job_queue (school_id);

-- ai_usage (unique par école)
CREATE UNIQUE INDEX ON ai_usage (school_id);
```

### Partitionnement (futur)

Si > 1M insights : partition `ai_insights` par `school_id` (list) ou `generated_at` (range mensuel).

## API Gateway (AI Gateway)

- **StatisticalProvider** : 0 dépendance externe, latence < 5ms, throughput illimité
- **LLMProvider** : optionnel, rate-limited par provider externe
- **MockProvider** : tests uniquement

Pas de cache nécessaire pour StatisticalProvider (calcul pur). Pour LLM : cache sémantique possible (embeddings + similarité).

## File de jobs (`ai_job_queue`)

- Polling `runPendingJobs(10)` toutes les 30s via cron/edge function
- Backoff exponentiel : 15min, 1h, 6h (max 3 attempts)
- Dead letter : `status=failed` après max attempts → alerte admin

## Quotas & Rate Limiting

| Plan | requests/mois | burst/jour | tokens/mois |
|------|---------------|------------|-------------|
| starter | 200 | 50 | 50k |
| standard | 1 000 | 200 | 200k |
| pro | 5 000 | 1 000 | 1M |

Vérification côté serveur avant appel (`bumpAiUsage` atomique). Rejet 429 si dépassé.

## Assistant

- Scope RLS : max 8 insights par query
- Prompt ~500 tokens max (contexte + question)
- StatisticalProvider : réponse < 10ms
- LLM (si activé) : timeout 30s, fallback auto

## Monitoring

### Métriques clés

| Métrique | Source | Alerte |
|----------|--------|--------|
| Jobs failed > 5/j | `ai_job_queue` | PagerDuty |
| Quota > 90% | `ai_usage` | Email admin |
| Insights générés chute > 50% | `ai_insights` (count/jour) | Slack |
| Latence assistant > 5s | `ai_audit_logs` (latency_ms) | Log |

### Dashboards suggérés (Grafana/Supabase)

- Insights par jour / école / sévérité
- Usage IA par plan
- Queue depth + processing time
- Assistant queries + fallback rate

## Capacités actuelles (Phase 8)

- ✅ 100 écoles, 2k élèves/école
- ✅ StatisticalProvider illimité
- ✅ Queue 1k jobs/jour
- ✅ RLS natif (pas de middleware auth)

## Prochaines étapes (voir future_scale.md)

- Partitionnement tables
- Cache LLM sémantique
- Workers dédiés (BullMQ/Redis)
- Vector search (pgvector) pour RAG