# EduTrack — Environments & Deployment

## Architecture

```
Developer (local)
    ↓ git push
GitHub (main)
    ↓ CI (lint, typecheck, test, build)
GitHub Actions
    ↓ Deploy Preview (Vercel)
Staging (vercel.app)
    ↓ Tests E2E + Smoke
    ↓ Validation manuelle
    ↓ Approval
Production (vercel.app / custom domain)
```

**Règle** : Jamais de développement direct sur la base Production.
Toutes les modifications SQL via migrations versionnées (`supabase/migrations/`).

---

## Variables d'Environnement

### Catégories

| Préfixe | Description | Exemple |
|---------|-------------|---------|
| `NEXT_PUBLIC_*` | Exposé au navigateur (build-time) | `NEXT_PUBLIC_SUPABASE_URL` |
| *(sans préfixe)* | Secrets serveur uniquement | `SUPABASE_SERVICE_ROLE_KEY` |
| `CRON_*` | Secrets pour endpoints cron | `CRON_SECRET` |

### `.env.example` (template)

```env
# ── Application ──────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://edutrack.example.com

# ── Supabase ────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...

# Service role : JAMAIS côté client, JAMAIS dans NEXT_PUBLIC_*
# Utilisé uniquement : CI (migrations), scripts seed, server actions admin
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

# ── Auth / Security ─────────────────────────────────────────
# Secret pour signer les cookies de session (générer: openssl rand -base64 32)
AUTH_SECRET=

# Secret pour endpoints cron (/api/cron/*) — doit matcher Vercel Cron
CRON_SECRET=

# ── AI (Phase 8) ────────────────────────────────────────────
# Provider: "statistical" | "openai" | "anthropic" | "mock"
AI_PROVIDER=statistical
AI_API_KEY=                    # Requis si provider != statistical

# ── Observability ───────────────────────────────────────────
# Sentry DSN (optionnel — fallback logger si absent)
SENTRY_DSN=

# ── Email (optionnel) ───────────────────────────────────────
EMAIL_PROVIDER=resend|sendgrid|nodemailer
EMAIL_API_KEY=
EMAIL_FROM=EduTrack <no-reply@edutrack.example.com>

# ── SMS/WhatsApp (optionnel, Phase 8) ───────────────────────
SMS_PROVIDER=twilio|messagebird
SMS_API_KEY=
SMS_FROM=+33XXXXXXXXX

WHATSAPP_PROVIDER=whatsapp-cloud-api
WHATSAPP_API_KEY=
WHATSAPP_PHONE_NUMBER_ID=
```

---

## Environnements

### Local (Development)

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Projet Supabase **local** ou **dev** |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service du projet **dev** |
| `AI_PROVIDER` | `statistical` ou `mock` |
| `CRON_SECRET` | `dev-secret-change-me` |

**Commandes** :
```bash
npm run dev                    # Next.js + Turbopack
npm run db:migrate             # supabase db push (vers dev)
npm run db:seed                # Seed démo (vers dev)
npm run test                   # Unit tests
npm run test:e2e               # Playwright (headless)
```

### Staging

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://edutrack-staging.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Projet Supabase **staging** |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service **staging** (Vercel Secret) |
| `AI_PROVIDER` | `statistical` |
| `CRON_SECRET` | Généré aléatoirement (Vercel Secret) |
| `SENTRY_DSN` | DSN Sentry staging |

**Déploiement** : Automatique sur push `main` → Preview Vercel → Tests E2E → Promotion manuelle.

**Base** : Projet Supabase dédié `edutrack-staging` (copie schématique de prod, données anonymisées).

### Production

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://edutrack.example.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Projet Supabase **production** |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service **prod** (Vercel Secret, rotation 90j) |
| `AI_PROVIDER` | `statistical` (ou `openai` si configuré) |
| `CRON_SECRET` | Généré aléatoirement (Vercel Secret, rotation 90j) |
| `SENTRY_DSN` | DSN Sentry production |
| `EMAIL_PROVIDER` / `EMAIL_API_KEY` | Configuré |
| `SMS_PROVIDER` / `SMS_API_KEY` | Configuré si activé |

**Déploiement** : Manuel via GitHub Actions `production.yml` avec approval requis.

**Base** : Projet Supabase `edutrack-prod` — **PITR activé** (Point-in-Time Recovery).

---

## Secrets Management

| Secret | Stockage | Rotation | Accès |
|--------|----------|----------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel Secrets / 1Password | 90j | CI, scripts seed, server actions admin |
| `CRON_SECRET` | Vercel Secrets | 90j | Vercel Cron, server actions cron |
| `AUTH_SECRET` | Vercel Secrets | 180j | NextAuth / middleware |
| `SENTRY_DSN` | Vercel Secrets | — | Build + Runtime |
| `EMAIL_API_KEY` | Vercel Secrets | 90j | Server actions email |
| `SMS_API_KEY` | Vercel Secrets | 90j | Server actions SMS |
| `AI_API_KEY` | Vercel Secrets | 90j | AI Gateway |

**Règle** : Aucun secret dans `.env.local`, `.env.production`, Git, logs, erreurs, analytics, HTML.

---

## Supabase Projects

| Env | Project Ref | Région | PITR | Backups |
|-----|-------------|--------|------|---------|
| Local | `local` (Docker) | — | Non | Non |
| Dev | `expekdmafmqybbnmsmpy` | EU West | Non | Non |
| Staging | `xxx-staging` | EU West | 7j | Quotidien |
| Production | `xxx-prod` | EU West | 30j | Quotidien + PITR |

**Migration** : Toujours via `supabase/migrations/` versionnées. Jamais `ALTER TABLE` direct en prod.

---

## Vercel Projects

| Env | Project | Domaine | Build Command | Output |
|-----|---------|---------|---------------|--------|
| Preview | `edutrack` | `*.vercel.app` | `npm run build` | `.next` |
| Staging | `edutrack-staging` | `staging.edutrack.example.com` | `npm run build` | `.next` |
| Production | `edutrack-prod` | `edutrack.example.com` | `npm run build` | `.next` |

**Build Env** : Variables `NEXT_PUBLIC_*` + `SUPABASE_SERVICE_ROLE_KEY` (pour build-time DB access si nécessaire).

---

## Règles de Déploiement

1. **Main branch** → Preview automatique (Vercel)
2. **PR merge** → Preview + CI (lint, typecheck, test, build)
3. **Staging** : Promotion manuelle depuis Preview (bouton Vercel "Promote to Staging")
4. **Production** : Workflow `production.yml` avec **approval manuel** + tag `vX.Y.Z`
5. **Rollback** : Vercel "Rollback" (instantané) ou `git revert` + redeploy

---

## Checklist Pré-Déploiement Production

- [ ] CI vert sur `main` (lint, typecheck, test, build)
- [ ] Tests E2E passent sur Staging
- [ ] Migration DB appliquée sur Staging + validée
- [ ] Variables d'env Production configurées dans Vercel
- [ ] Secrets Production configurés dans Vercel (pas dans Git)
- [ ] Supabase PITR activé sur prod
- [ ] Sentry DSN prod configuré
- [ ] Health checks `/api/health` et `/api/ready` répondent 200
- [ ] Cron secrets configurés + cron Vercel activés
- [ ] Sentry alertes configurées (error rate, latency)
- [ ] Backup/recovery testé (restore staging depuis backup prod)
- [ ] Rollback testé (Vercel rollback + migration down)
- [ ] Monitoring dashboards créés (Vercel + Sentry + Supabase)