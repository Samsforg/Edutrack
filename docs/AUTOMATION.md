# Automatisation — Jobs, Queue, Détection

## File de jobs (`ai_job_queue`)

Table durable style PGMQ simplifiée :
- `job_type` : `detect-attendance-risks` | `detect-performance-risks` | `detect-class-anomalies` | `generate-weekly-digests` | `cleanup-expired-insights`
- `school_id` : null (global) ou école cible
- `payload` : JSON paramètres
- `status` : `pending` | `processing` | `completed` | `failed`
- `attempts` / `max_attempts` (défaut 3)
- `run_at` : planification
- `last_error` : message erreur

Index : `(status, run_at)` pour polling efficace.

## Runner (`runPendingJobs`)

```typescript
await runPendingJobs(limit = 10);
```

Logique :
1. SELECT `pending` + `run_at <= now()` ORDER BY created_at LIMIT N
2. Pour chaque job : `UPDATE status=processing`
3. Exécute handler selon `job_type`
4. Succès : `UPDATE status=completed, attempts+1`
5. Échec : `UPDATE status=pending/failed, attempts+1, last_error, run_at=now+15min`

## Jobs de détection

### `detect-attendance-risks(schoolId)`
- Liste élèves actifs de l'école
- Pour chacun : `buildStudentRiskInput` → `detectStudentRisks` → `insertInsight`
- Types générés : `attendance_risk`, `attendance_drop`

### `detect-performance-risks(schoolId)`
- Même boucle élèves
- Types : `performance_drop`, `performance_risk`, `positive_trend`, `improvement`

### `detect-class-anomalies(schoolId)`
- Liste classes de l'école
- Calcule taux présence + moyenne sur fenêtre
- Type : `class_anomaly` si présence < 85% ou moyenne < 10

## Nettoyage

### `cleanup-expired-insights`
- `UPDATE ai_insights SET status='resolved' WHERE status='active' AND expires_at < now()`
- Exécuté quotidiennement via job planifié

## Weekly Digest

### `generate-weekly-digests` (global, school_id=null)
- Pour chaque école active :
  - Agrège présence/retards/moyenne 7j
  - Récupère insights actifs (positifs + à surveiller)
  - Envoie notification `weekly_summary` aux parents + admins via `notifyBillingUsers`

## Planification (cron suggéré)

| Job | Fréquence | run_at initial |
|-----|-----------|----------------|
| detect-attendance-risks | quotidienne 02:00 | 02:00 |
| detect-performance-risks | quotidienne 03:00 | 03:00 |
| detect-class-anomalies | quotidienne 04:00 | 04:00 |
| cleanup-expired-insights | quotidienne 05:00 | 05:00 |
| generate-weekly-digests | hebdo lundi 06:00 | lundi 06:00 |

## Déclenchement manuel

Pages admin :
- `/app/admin/ai` → boutons "Lancer analyse" (enqueue job école)
- `/app/super-admin/ai` → boutons globaux (enqueue job global)

## Monitoring

- `ai_job_queue` : compteur `status=failed` → alerte
- `ai_usage` : `insights` générés par école/jour
- Logs : `ai_audit_logs` (action: `job.detect-attendance-risks`, etc.)

## Idempotence & Déduplication

- `insertInsight` vérifie `dedup_key` actif (24h TTL)
- `buildDedupKey(school, student, class, type, windowStart)` déterministe
- Relance job = pas d'insights doublons

## Tests

- `tests/unit/ai-detect.test.ts` — logique détection + déduplication
- Tests d'intégration : mocker `createAdminClient` pour vérifier inserts