# Sécurité IA — EduTrack

## Principes

1. **Zéro donnée personnelle dans les logs d'audit** : `ai_audit_logs` ne contient que métadonnées (action, modèle, types I/O, latence, tokens). Pas de PII.
2. **RLS partout** : toutes les tables IA activent Row Level Security. Les politiques réutilisent les helpers existants (`is_school_member`, `is_admin_of_school`, `parent_of_student`, `user_teaches_class`, `is_super_admin`).
3. **Périmètre strict (scope)** : l'assistant ne reçoit que les insights actifs du périmètre autorisé (max 8). Jamais l'ensemble des élèves/notes/présences.
4. **Pas d'appel LLM sans garde-fou** : Gateway essaie le provider configuré, sinon retombe sur StatisticalProvider. Aucune fonctionnalité core ne bloque.
5. **Données interdites dans les prompts** : règles FR + `FORBIDDEN_RULE` (pas d'emails, téléphones, adresses, IDs bruts, hash, tokens).
6. **Feature flags** : activation progressive (pilot → beta → enabled). Désactivé par défaut pour les fonctions IA.

## Matrice d'accès

| Rôle | ai_insights | ai_audit_logs | ai_usage | feature_flags | knowledge_docs | ai_job_queue |
|------|-------------|---------------|----------|---------------|----------------|--------------|
| PARENT | propres enfants (RLS) | ❌ | ❌ | lecture globale | global | ❌ |
| TEACHER | ses classes + élèves (RLS) | ❌ | ❌ | lecture globale | global | ❌ |
| SCHOOL_ADMIN | son école (RLS) | ❌ | son école (RLS) | son école (RW) | son école + global | ❌ |
| SUPER_ADMIN | tout | tout | tout | tout (RW) | tout | lecture |

## Audit Trail

Chaque appel IA écrit dans `ai_audit_logs` :
- `school_id`, `user_id` (nullable)
- `action` : ex `assistant.query`, `summary.student`, `insight.generate`
- `model` : `statistical` | `llm` | `mock`
- `input_type` / `output_type`
- `latency_ms`, `tokens_used`

## Quotas & Rate Limiting

- `ai_usage` suit `requests_day`, `requests_month`, `summaries`, `insights`, `tokens_used`
- Vérification avant appel (dans les pages/actions serveur)
- Blocage si quota dépassé (retour erreur utilisateur, pas d'exception)

## Communications

- Opt-in explicite par canal (SMS, WhatsApp, email, push) via `communication_preferences`
- No-op par défaut — aucun SMS/WhatsApp envoyé sans provider configuré
- Respect du consentement RGPD

## Checklist déploiement

- [ ] Migration 0018 appliquée
- [ ] RLS vérifié sur toutes tables IA
- [ ] Feature flags seedés (`pilot` pour IA, `disabled` pour SMS/WhatsApp)
- [ ] Quotas configurés par plan
- [ ] Tests unitaires passent
- [ ] Build + lint + typecheck OK