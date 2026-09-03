# Future Scaling — Post-Phase 8

## Horizon 6-12 mois

### 1. Partitionnement tables lourdes

```sql
-- ai_insights partitionné par generated_at (mensuel)
CREATE TABLE ai_insights_2025_01 PARTITION OF ai_insights
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- ai_audit_logs partitionné par created_at (mensuel)
-- ai_job_queue partitionné par school_id (list) si > 10k écoles
```

### 2. Workers dédiés (BullMQ + Redis)

Remplacer `runPendingJobs` polling par workers BullMQ :
- Concurrence contrôlée (ex 5 workers)
- Retry/backoff natif
- Dashboard Bull Board
- Priorité jobs (critical > high > normal)

### 3. Cache sémantique LLM

Si LLM activé :
- Embedding question utilisateur (text-embedding-3-small)
- Recherche similarité cosinus > 0.95 dans cache Redis
- Hit → réponse instantanée, miss → appel LLM + store

### 4. Vector Search (pgvector + RAG)

Activer `knowledge_documents.embedding` + HNSW index :
- Chunking docs (500 tokens, overlap 50)
- Embedding à l'insertion (batch nightly)
- Assistant : retrieval top-k → contexte → LLM
- Fallback StatisticalProvider si pgvector indisponible

### 5. Streaming Assistant

Remplacer `generateText` par `generateStream` :
- Server-Sent Events (SSE) ou WebSocket
- Affichage progressif type ChatGPT
- Annulation possible (AbortController)

### 6. Multi-région / Edge

- Déployer StatisticalProvider sur Edge (Vercel Edge Functions / Cloudflare Workers)
- Latence < 50ms global
- Queue jobs : worker par région, `school_id` affine

### 7. Observabilité avancée

- OpenTelemetry tracing (spans: detect, gateway, assistant)
- Métriques Prometheus : `edu_ai_insights_total`, `edu_ai_queue_depth`, `edu_ai_assistant_latency`
- Alertes : quota, queue backlog, fallback rate > 10%

### 8. Feature Flags avancés

- Rollout par % utilisateurs (pas seulement école)
- A/B testing prompts assistant
- Kill-switch global par feature

### 9. Compliance & Data Residency

- Chiffrement au repos (Supabase géré)
- Clés gérées client (CMEK) optionnel
- Purge auto données > 2 ans (RGPD)
- Export utilisateur (DSAR) inclut insights le concernant

### 10. ML Pipeline (si volume > 100k insights/mois)

- Entraînement modèle léger (XGBoost/LightGBM) sur features risque
- Prédiction hebdo : "élèves à risque semaine prochaine"
- Feature store (Feast) pour features réutilisables
- Monitoring drift (PSI sur features)

## Non-objectifs (Phase 8)

- ❌ Kubernetes / microservices
- ❌ GPU / fine-tuning LLM
- ❌ Mobile natif
- ❌ Blockchain / crypto
- ❌ Vidéo / appel temps réel

## Checklist migration future

- [ ] Partitionnement validé en staging
- [ ] BullMQ workers déployés + healthcheck
- [ ] Cache sémantique LLM benchmarqué
- [ ] pgvector activé + index HNSW testé
- [ ] SSE streaming assistant implémenté
- [ ] OpenTelemetry intégré
- [ ] Runbook incident (queue bloquée, quota exceeded, LLM down)