# Pilot Mode — EduTrack

## Objectif

Valider EduTrack en conditions réelles avant ouverture commerciale.

> **Cible** : 1 école pilote, 100-300 élèves, 100-300 parents, 10-30 enseignants, 30-60 jours.

---

## Critères de Sélection École Pilote

| Critère | Minimum | Idéal |
|---------|---------|-------|
| Élèves | 100 | 200-300 |
| Parents connectés | 50% | 80%+ |
| Enseignants | 10 | 20-30 |
| Classes | 5 | 10-15 |
| Niveaux | Primaire + Secondaire | Mixte |
| Connectivité | 4G/WiFi stable | Fibre + 4G backup |
| Équipe admin | 1 admin dédié | 1 admin + 1 adjoint |
| Volonté | Signature contrat pilote | Engagement 60 jours |

---

## Fonctionnalités Pilote (Feature Flags)

| Flag | État Pilote | Rationale |
|------|-------------|-----------|
| `ai_insights` | `pilot` | Core value, feedback essentiel |
| `ai_assistant` | `pilot` | Différenciateur, test adoption |
| `ai_summaries` | `pilot` | Gain temps admin/prof |
| `weekly_digest` | `beta` | Déjà testé internement |
| `advanced_analytics` | `enabled` | Core produit |
| `realtime_attendance` | `enabled` | Core produit |
| `reports_export` | `enabled` | Core produit |
| `sms` | `disabled` | Coût, pas critique pilote |
| `whatsapp` | `disabled` | Coût, pas critique pilote |
| `semantic_search` | `disabled` | RAG v2 |

**Configuration** : Dans `/app/super-admin/ai` → Feature flags →'école pilote → override.

---

## Onboarding Pilote (Semaine 1)

### Jour 1-2 : Setup Technique
- [ ] Créer école sur Staging → promouvoir Prod
- [ ] Configurer abonnement `pro` (gratuit pilote) via super-admin
- [ ] Activer feature flags pilote pour `school_id`
- [ ] Vérifier health checks `/api/ready` OK
- [ ] Configurer domaine custom si demandé

### Jour 3-4 : Données & Comptes
- [ ] Import CSV (élèves, parents, enseignants, classes) via wizard
- [ ] Vérifier `data-integrity-check.sql` → 0 erreurs
- [ ] Créer comptes admin/enseignants/parents (invitation email)
- [ ] Tester liaison parent-enfant (codes + approbation)
- [ ] Configurer année scolaire active + périodes

### Jour 5 : Formation & Go-Live
- [ ] Session 1h admin (dashboard, imports, abonnement, AI)
- [ ] Session 1h enseignants (présence, notes, évaluations, AI assistant)
- [ ] Session 30min parents (liaison, notifications, dashboard)
- [ ] Activer notifications temps réel
- [ ] **Go-Live** : communication officielle aux parents

---

## Métriques de Succès (KPIs Pilote)

### Adoption (Semaine 1-4)
| KPI | Cible Semaine 1 | Cible Semaine 4 |
|-----|-----------------|-----------------|
| Parents activés (login) | > 50% | > 80% |
| Parents hebdo (WAU) | > 30% | > 60% |
| Enseignants quotidiens (DAU) | > 70% | > 90% |
| Admin hebdo | 100% | 100% |

### Usage Fonctionnel
| KPI | Cible |
|-----|-------|
| Présences saisies / jour ouvré | > 90% classes |
| Notes publiées / semaine | > 5 évaluations |
| Annonces publiées / semaine | > 2 |
| Liaisons parent-enfant validées | > 90% |
| AI Assistant requêtes / semaine | > 20 (admin) |
| Insights AI consultés / semaine | > 50 |

### Qualité
| KPI | Seuil |
|-----|-------|
| Error rate (Sentry) | < 0.5% |
| Latence P95 (Vercel) | < 800ms |
| Disponibilité | > 99.5% |
| NPS (enquête fin pilote) | > 40 |

### Adoption IA (Phase 8)
| KPI | Cible |
|-----|-------|
| Admin utilisant Assistant / semaine | > 50% |
| Insights AI consultés (acknowledged) | > 60% |
| Résumés élève générés | > 10/semaine |
| Fallback rate AI | < 5% |

---

## Enquête Fin de Pilote (Jour 60)

### Questionnaire Admin
1. **Facilité setup** (1-5) : Import, config, feature flags
2. **Gain temps** (heures/semaine) : Admin, secrétariat
3. **Qualité insights AI** : Pertinence, actionnabilité
4. **Support** : Réactivité, clarté docs
5. **Recommandation** (NPS 0-10) : Recommanderiez-vous ?

### Questionnaire Enseignants
1. **Facilité présence** (1-5) : Saisie, correction, historique
2. **Facilité notes** (1-5) : Création éval, saisie grille, publication
3. **Assistant AI** : Utile ? Exemples concrets
4. **Charge mentale** : Réduite / inchangée / augmentée
5. **Recommandation** (NPS 0-10)

### Questionnaire Parents (échantillon 20%)
1. **Facilité liaison** (1-5) : Code, approbation, dashboard
2. **Infos reçues** : Pertinence, fréquence, clarté
3. **Notifications** : Utiles ? Trop ? Pas assez ?
4. **Confiance** : Données sécurisées ? Transparence ?
5. **Recommandation** (NPS 0-10)

---

## Décision Post-Pilote

| Résultat | Action |
|----------|--------|
| **NPS > 40**, KPIs verts, 0 incident SEV-1 | **Lancement commercial** — Onboarding standardisé |
| **NPS 20-40**, KPIs mixtes, 1-2 incidents SEV-2 | **Pilote étendu 30j** — Correctifs ciblés |
| **NPS < 20** ou incident SEV-1 | **Arrêt / Redesign** — Analyse root cause, redesign |

---

## Checklist Technique Fin de Pilote

- [ ] Export données école (JSON/CSV) pour archivage
- [ ] Désactiver feature flags pilote (retour `disabled`/`internal`)
- [ ] Revert abonnement `pro` gratuit → plan choisi
- [ ] Export logs audit (`ai_audit_logs`, `billing_events`) pour audit
- [ ] Sauvegarde PITR timestampée (tag `pilot-end-YYYYMMDD`)
- [ ] Rapport final PDF (ce doc + métriques + verbatims)
- [ ] Débrief équipe (30 min) → actions amélioration produit

---

## Modèle Contractuel Pilote

| Élément | Détail |
|---------|--------|
| **Durée** | 60 jours calendaires |
| **Coût** | Gratuit (plan Pro offert) |
| **Support** | Slack canal dédié + email 24h ouvrées |
| **SLA** | Best effort (pas de SLA contractuel pilote) |
| **Données** | Propriété école, export gratuit fin pilote |
| **Résiliation** | Libre à tout moment (préavis 7j) |
| **Données post-pilote** | Conservation 30j puis suppression si non-client |
| **Renouvellement** | Négociation commerciale standard |

---

## Risques & Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Faible adoption parents | Moyenne | Échec pilote | Formation parents + relances + simplification liaison |
| Enseignants résistants | Faible | Usage partiel | Formation pratique + binôme "champion" |
| Instabilité technique | Faible | Perte confiance | Monitoring 24/7, rollback instantané Vercel |
| Fuite données cross-school | Très faible | Juridique/Réputation | Tests RLS automatisés + audit pre-pilote |
| Coûts AI imprévus | Faible | Budget | Quotas stricts + alerting 80% |
| Perte données | Très faible | Critique | PITR 30j + test restore mensuel |