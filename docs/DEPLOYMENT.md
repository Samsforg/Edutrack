# Déploiement (Vercel)

Ce document couvre le déploiement sur Vercel du monorepo Next.js (App Router)
avec Supabase hébergé.

## Prérequis

- Projet Supabase avec les migrations appliquées (voir `DATABASE.md` ou exécuter
  `docs/db-bootstrap.sql` dans l'éditeur SQL).
- Un compte Vercel connecté au dépôt Git.

## Variables d'environnement

Créer dans Supabase : **Settings → API** → copier l'URL, la clé anon
(`sb_publishable_…`) et la clé service (`sb_secret_…`).

| Variable | Valeur |
| -------- | ------ |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé **anon/publishable** (cliente) |
| `SUPABASE_SERVICE_ROLE_KEY` | clé **service role** (côté serveur seulement) |
| `NEXT_PUBLIC_APP_URL` | URL de l'app Vercel (`https://…vercel.app`) |

> La clé service ne doit **jamais** être exposée au navigateur.

## Configuration Supabase (hosted)

Dans le dashboard Supabase → **Authentication → URL Configuration** :

- `Site URL` : l'URL Vercel.
- `Redirect URLs` : `<APP_URL>/auth/callback`.
- Désactiver la confirmation email pour les tests (ou la garder pour la prod).

## Déployer

1. Importer le repo dans Vercel.
2. Framework : Next.js (détecté automatiquement).
3. Ajouter les variables d'environnement ci-dessus.
4. `migrations` : appliquées côté Supabase (pas au build).
5. Deploy. Puis relancer un seed si nécessaire :

```bash
npm run db:seed
```

## Vérifications après déploiement

- `/login` charge.
- Un parent lié voit ses enfants dans `/app/parent`.
- Le flux annonce → notification remplit le cloche du parent.
- `npm run test:e2e` (avec `NEXT_PUBLIC_APP_URL` pointant vers l'app déployée).

## CI

`.github/workflows/ci.yml` exécute lint, tests unitaires et build sur chaque
push/PR. Les tests E2E Playwright utilisent un serveur de dev local (base
Supabase réelle, données seed).
