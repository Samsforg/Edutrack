# Processus de Release — EduTrack

## Versioning

**SemVer** : `MAJOR.MINOR.PATCH`
- **MAJOR** : Breaking changes (migration destructive, API breaking)
- **MINOR** : Nouvelles fonctionnalités (Phase N)
- **PATCH** : Bugfixes, security, docs

**Tags Git** : `v0.9.0`, `v0.9.1`, etc.

---

## Branches

| Branche | Usage | Protection |
|---------|-------|------------|
| `main` | Production-ready | Required reviews (1), CI passed, no direct push |
| `develop` | Intégration continue | CI passed |
| `feature/*` | Nouvelles fonctionnalités | Rebase sur `develop` |
| `fix/*` | Corrections | Rebase sur `develop` ou `main` |
| `release/*` | Préparation release | Freeze features, tests only |

---

## Pipeline CI/CD

### 1. Pull Request (feature/fix → develop/main)
```yaml
- lint
- typecheck
- unit tests
- build (Vercel preview)
```

### 2. Merge vers `develop`
```yaml
- lint
- typecheck
- unit tests
- build
- deploy Staging (auto)
- E2E tests sur Staging
```

### 3. Release (tag `vX.Y.Z` sur `main`)
```yaml
- lint
- typecheck
- unit tests
- build
- deploy Production (manuel + approval)
- Tag Git créé
- Changelog mis à jour
```

---

## Checklist Pré-Release

### Code
- [ ] `npm run lint` → 0 erreurs
- [ ] `npm run typecheck` → 0 erreurs
- [ ] `npm run test` → 100% pass
- [ ] `npm run build` → succès
- [ ] `npm run test:e2e` sur Staging → 100% pass

### Base de Données
- [ ] Migrations appliquées sur Staging + validées
- [ ] `data-integrity-check.sql` → 0 erreurs critiques sur Staging
- [ ] Migration script revue par 2 devs
- [ ] Rollback plan documenté (PITR timestamp)

### Sécurité
- [ ] Aucun secret dans Git (`git secrets --scan`)
- [ ] Aucune clé service côté frontend
- [ ] Rate limiting testé sur routes critiques
- [ ] Security headers vérifiés en prod

### Performance
- [ ] Bundle size < 250KB (gzipped)
- [ ] Core Web Vitals : LCP < 2.5s, INP < 200ms, CLS < 0.1
- [ ] Pagination sur toutes listes > 50 items
- [ ] Requêtes DB optimisées (EXPLAIN ANALYZE)

### Monitoring
- [ ] Health checks `/api/health` + `/api/ready` OK
- [ ] Sentry DSN configuré + test capture
- [ ] Métriques Prometheus `/api/metrics` accessibles
- [ ] Alertes Sentry/Vercel configurées

### Business
- [ ] Feature flags par défaut corrects (pilot/disabled)
- [ ] Seed production désactivé par défaut
- [ ] Pricing/plans à jour
- [ ] Super-admin control center fonctionnel

---

## Processus de Release (Étapes)

### 1. Préparation (J-1)
```bash
# Sur branche develop
git checkout develop
git pull origin develop

# Vérifier que tout est vert
npm run lint && npm run typecheck && npm run test && npm run build

# Créer branche release
git checkout -b release/v0.9.0
```

### 2. Freeze & Tests (Jour J)
```bash
# Sur release/v0.9.0
# - Freeze features (pas de nouveaux commits features)
# - Seulement bugfixes critiques
# - Mettre à jour CHANGELOG.md
# - Mettre à jour version dans package.json
npm version minor --no-git-tag-version  # ou patch/major
```

### 3. Validation Staging
```bash
# Deploy sur Staging (auto via GitHub Actions)
# Lancer tests E2E complets
npm run test:e2e

# Validation manuelle checklists
# - Login tous rôles
# - Dashboards parent/teacher/admin/super
# - AI assistant, insights, jobs
# - Billing flow
# - Import/Export
```

### 4. Tag & Merge
```bash
# Sur release/v0.9.0
git add .
git commit -m "chore: release v0.9.0"
git tag -a v0.9.0 -m "Release v0.9.0 - Phase 9 Production Hardening"
git push origin release/v0.9.0 --tags

# PR vers main (avec approval)
# Après merge → GitHub Actions production deploy (manuel approval)
```

### 5. Post-Release (J+1)
- [ ] Vérifier health checks prod
- [ ] Vérifier Sentry (0 nouvelles erreurs)
- [ ] Vérifier métriques (error rate, latency)
- [ ] Communiquer release notes (Slack, email clients si majeur)
- [ ] Merge main → develop (sync)
- [ ] Fermer milestone GitHub

---

## Rollback Procedure

### Application (Vercel)
```bash
# Instantané via Dashboard Vercel
# Deployments → ... → Rollback

# Ou CLI
vercel rollback <deployment-url> --token=$VERCEL_TOKEN
```

### Base de Données (Supabase PITR)
```bash
# Via Dashboard Supabase → Database → Backups → PITR
# Choisir timestamp avant incident
# Crée nouveau projet restauré
# Switch connection strings
```

### Feature Flags (Kill Switch)
```sql
-- Désactiver feature problématique immédiatement
UPDATE feature_flags SET rollout = 'disabled' WHERE key = 'ai_assistant';
```

---

## Communication

### Release Notes (Template)
```markdown
# EduTrack v0.9.0 — Phase 9 Production Hardening

## 🎉 Nouvelles fonctionnalités
- Observabilité complète (logs, métriques, health checks, error tracking)
- Rate limiting sur routes critiques
- Feature flags système avec rollout progressif
- Security headers production (CSP, HSTS, etc.)
- Data integrity checks automatisés

## 🔧 Corrections
- Rate limiting auth/AI/imports
- PWA service worker durci
- Security headers production

## 🔒 Sécurité
- Rate limiting sur routes critiques
- CSP strict + HSTS en production
- Sanitization logs/erreurs

## 📦 Migrations
- Aucune (Phase 9 = code only)

## ⚠️ Breaking Changes
- Aucun

## 📋 Checklist validée
- [x] Tests CI/CD
- [x] E2E Staging
- [x] Security audit
- [x] Performance budget
```

### Canaux
- Slack `#releases` (équipe)
- Email clients (si MAJOR ou breaking)
- Status page (si incident lié)
- In-app banner (si action requise utilisateur)

---

## Hotfix Process

Pour corrections urgentes sur `main` :
```bash
git checkout main
git checkout -b fix/v0.9.1-critical-bug
# Fix + test
npm version patch --no-git-tag-version
git commit -am "fix: critical bug description"
git tag -a v0.9.1 -m "Hotfix v0.9.1"
git push origin main --tags
# Deploy auto prod
```