# Incident Response — EduTrack

## Procédure Standard (6 Étapes)

```
DETECT → ASSESS → CONTAIN → RECOVER → VERIFY → COMMUNICATE → POSTMORTEM
```

---

## 1. DETECT (Détection)

### Sources d'alerte
| Source | Outil | Contact |
|--------|-------|---------|
| Erreurs applicatives | Sentry | #alerts-sentry |
| DB indisponible | Supabase Alerts | #alerts-supabase |
| Build/Deploy échoué | Vercel / GitHub Actions | #alerts-ci |
| Latence / Erreurs HTTP | Vercel Analytics | #alerts-vercel |
| Queue jobs bloquée | Custom metric | #alerts-jobs |
| Quota AI dépassé | Custom metric | #alerts-ai |
| Billing webhook échoué | Custom metric | #alerts-billing |

### Seuils d'alerte (exemples)
- Error rate > 1% sur 5 min
- P95 latency > 2s sur 5 min
- DB CPU > 80% sur 10 min
- Queue depth > 100 sur 5 min
- AI fallback rate > 10%

---

## 2. ASSESS (Évaluation)

### Grille de sévérité

| Niveau | Critères | Exemples | Temps de réponse |
|--------|----------|----------|------------------|
| **SEV-1 (Critical)** | Service down, perte données, faille sécurité | DB down, auth broken, fuite PII | **Immédiat** (15 min) |
| **SEV-2 (High)** | Fonctionnalité majeure cassée | AI down, notifications bloquées, imports échouent | **30 min** |
| **SEV-3 (Medium)** | Dégradation partielle | Lenteur, feature mineure cassée | **2h** |
| **SEV-4 (Low)** | Bug mineur, cosmetic | Typo, UI glitch | **Prochain sprint** |

### Checklist d'évaluation (5 min max)
- [ ] Quel service/fonctionnalité ?
- [ ] Combien d'utilisateurs/écoles impactés ?
- [ ] Perte de données ? (oui/non)
- [ ] Faille sécurité ? (oui/non)
- [ ] Workaround possible ? (oui/non)
- [ ] Cause identifiée ? (oui/non)

---

## 3. CONTAIN (Contenir)

### Actions immédiates par type

| Type incident | Action contenement |
|---------------|-------------------|
| **DB down** | Activer read-only mode via feature flag `maintenance_mode` |
| **Auth broken** | Vérifier config Supabase Auth, rollback config si changement récent |
| **AI provider down** | Feature flag `ai_assistant` → `disabled`, `ai_insights` → `disabled` |
| **Notifications bloquées** | Disable `weekly_digest`, `sms`, `whatsapp` flags |
| **Import bloqué** | Feature flag `imports_enabled` → `disabled` |
| **Fuite PII** | Révoquer clés API concernées, rotate secrets, audit logs |
| **Bad deploy** | Vercel rollback instantané (bouton "Rollback") |
| **Bad migration** | Ne JAMAIS rollback migration destructive → PITR uniquement |

### Feature Flags d'urgence (super-admin)
```sql
-- Maintenance mode global
INSERT INTO feature_flags (key, rollout, school_id) VALUES
('maintenance_mode', 'enabled', NULL)
ON CONFLICT (key) DO UPDATE SET rollout = 'enabled';
```

---

## 4. RECOVER (Récupérer)

### Playbooks par scénario

#### A. Base de données indisponible
1. Vérifier status Supabase (status.supabase.com)
2. Si régional → attendre rétablissement (SLA)
3. Si corruption → PITR vers timestamp sain (voir BACKUP_RECOVERY.md)
4. Valider intégrité → `data-integrity-check.sql`
5. Réactiver feature flags

#### B. Fournisseur AI indisponible
1. Feature flag `ai_assistant` → `disabled`
2. Feature flag `ai_insights` → `disabled` (fallback statistical déjà actif)
3. Monitorer `ai_fallback_total` metric
4. Réactiver quand provider OK

#### C. Fournisseur Email/SMS indisponible
1. Feature flag `email` / `sms` / `whatsapp` → `disabled`
2. Notifications in-app restent actives
3. Réactiver quand provider OK

#### C. Bad Deployment
1. Vercel Dashboard → Deployments → "Rollback" sur version précédente
2. Attendre déploiement (2-3 min)
3. Vérifier health checks `/api/ready`
3. Postmortem si régression fonctionnelle

#### D. Migration SQL échouée / destructive
1. **NE JAMAIS** faire `DROP` / `ALTER` destructif sans PITR testé
2. Si migration appliquée et cassée → PITR immédiat
3. Corriger migration en dev → nouvelle migration corrective
4. Réappliquer sur staging → valider → prod

---

## 5. VERIFY (Vérifier)

### Checklist post-récupération
- [ ] Health check `/api/ready` → 200 OK
- [ ] Health check `/api/health` → 200 OK
- [ ] `data-integrity-check.sql` → 0 erreurs critiques
- [ ] Tests smoke E2E passent (login, dashboard, attendance, grades)
- [ ] Métriques normales (error rate < 0.1%, latency P95 < 500ms)
- [ ] Feature flags réactivés selon besoin
- [ ] Logs d'audit clean (pas d'erreurs résiduelles)

---

## 6. COMMUNICATE (Communiquer)

### Canaux
| Audience | Canal | Contenu |
|----------|-------|---------|
| Équipe interne | Slack #incidents | Temps réel, updates toutes les 15 min |
| Clients (écoles) | Status page + email | Résumé impact, ETA, workaround |
| Support | Ticket interne | Détails techniques pour support L1 |

### Templates

**Status Page (SEV-1/2)**
```
Titre: [SEV-1] Indisponibilité base de données - Investigation en cours
Impact: Toutes les écoles - Impossible d'accéder aux données
Début: 2025-01-15 14:32 UTC
Prochaine mise à jour: 14:45 UTC
Workaround: Aucune pour le moment
```

**Email Clients (si impact > 30 min)**
```
Objet: [EduTrack] Incident technique - Mise à jour
Corps: Description courte, impact, ETA, lien status page, contact support.
```

---

## 7. POSTMORTEM (Rétrospective)

### Délai : 48h max après résolution

### Template (docs/incidents/YYYY-MM-DD-incident-name.md)

```markdown
# Postmortem: [Titre incident]

## Résumé
- **Date**: YYYY-MM-DD
- **Durée**: XX min
- **Sévérité**: SEV-X
- **Impact**: X écoles, Y utilisateurs
- **Cause racine**: [Description technique]

## Chronologie
| Heure (UTC) | Événement |
|-------------|-----------|
| 14:32 | Alerte Sentry: error rate spike |
| 14:35 | On-call paged, investigation démarrée |
| 14:40 | Cause identifiée: migration 0019 cassée |
| 14:45 | PITR lancé vers 14:30 |
| 15:05 | Base restaurée, health checks OK |
| 15:10 | Feature flags réactivés |
| 15:15 | Tests smoke OK, incident clos |

## Cause Racine (5 Whys)
1. Pourquoi l'erreur ? Migration 0019 a cassé contrainte FK
2. Pourquoi migration cassée ? Test staging insuffisant (données différentes)
3. Pourquoi test insuffisant ? Pas de test d'intégrité post-migration
4. Pourquoi pas de test ? Processus CI ne lance pas `data-integrity-check`
5. Pourquoi CI incomplet ? Oubli lors de l'ajout Phase 8

## Actions Correctives
| Action | Responsable | Délai | Statut |
|--------|-------------|-------|--------|
| Ajouter `data-integrity-check` en CI | Lead Dev | J+7 | TODO |
| Documenter procédure PITR dans CI | DevOps | J+14 | TODO |
| Revue migrations par 2 devs | Équipe | Immédiat | DONE |

## Leçons Apprises
- Toujours tester migrations sur copie staging avec données réalistes
- Automatiser vérifications post-migration
- Feature flags d'urgence sauvent la mise
```

---

## Contacts d'Urgence

| Rôle | Nom | Téléphone | Slack | Escalade |
|------|-----|-----------|-------|----------|
| Lead Dev | — | — | @lead-dev | 15 min |
| DevOps | — | — | @devops | 15 min |
| Security | — | — | @security | 30 min |
| Product | — | — | @product | 1h |

---

## Runbooks Rapides (Liens)

- [DB PITR Restore](BACKUP_RECOVERY.md#1-restauration-base-de-données-pitr)
- [Vercel Rollback](https://vercel.com/docs/deployments/rollbacks)
- [Supabase Status](https://status.supabase.com)
- [Vercel Status](https://www.vercel-status.com)
- [Feature Flags Admin](/app/super-admin/ai)