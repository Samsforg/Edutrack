# EduTrack

> Le lien intelligent entre l'école et la famille.

EduTrack est un SaaS EdTech B2B2C qui permet aux établissements scolaires de
communiquer avec les parents et de leur fournir un suivi quasi temps réel de la
scolarité de leurs enfants : présences, absences, retards, notes, annonces et
notifications.

EduTrack est un projet **totalement indépendant** et ne partage ni code, ni
base de données, ni utilisateurs, ni dépendance technique avec Edukora.

## Stack

- **Frontend** : Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, PWA
- **Backend** : Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Validation** : Zod, React Hook Form
- **Tests** : Vitest (unitaires), Playwright (E2E)
- **CI** : GitHub Actions
- **Hosting** : Vercel

## Prérequis

- Node.js 20+
- Un projet Supabase (cloud ou [local via Supabase CLI](https://supabase.com/docs/guides/local-development))
- npm

## Installation

```bash
npm install
```

## Variables d'environnement

Copier `.env.example` vers `.env.local` et renseigner les valeurs :

```bash
cp .env.example .env.local
```

Variables requises :

| Variable                       | Description                                  |
| ------------------------------ | -------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`     | URL du projet Supabase                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| Clé publique `anon` (côté client)            |

> Ne jamais committer `.env.local`. La clé `service_role` ne doit jamais être
> utilisée dans le frontend.

## Développement

```bash
npm run dev
```

Ouvrir http://localhost:3000.

## Base de données & migrations

Les migrations SQL versionnées se trouvent dans `supabase/migrations/`. Elles
créent les tables, indexes, contraintes, fonctions et les politiques **Row
Level Security** (RLS).

Appliquer les migrations sur un projet Supabase :

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push
```

ou, en local :

```bash
supabase start
supabase db reset
```

## Seed (données de démonstration)

Commencer par appliquer les migrations, puis :

```bash
npm run db:seed
```

Ce script crée l'« Établissement Démo EduTrack », 3 classes (6ème A, 5ème A,
3ème A), des élèves, 2 enseignants, 3 parents, des présences, des notes et des
annonces.

### Comptes de test

| Rôle          | Email               | Mot de passe |
| ------------- | ------------------- | ------------ |
| Admin école   | admin@demo.edutrack | `demo-admin1!` |
| Enseignant    | teacher1@demo.edutrack | `demo-teach1!` |
| Enseignant 2  | teacher2@demo.edutrack | `demo-teach2!` |
| Parent 1      | parent1@demo.edutrack | `demo-parent1!` |
| Parent 2      | parent2@demo.edutrack | `demo-parent2!` |
| Parent 3      | parent3@demo.edutrack | `demo-parent3!` |
| Super-admin   | superadmin@demo.edutrack | `demo-superadmin1!` |

> Aucune donnée personnelle réelle n'est utilisée dans le seed.

## Tests

Tests unitaires (Vitest) :

```bash
npm test
```

Tests E2E (Playwright) :

```bash
npx playwright install --with-deps
npm run test:e2e
```

## Lint & build

```bash
npm run lint
npm run typecheck
npm run build
```

## Déploiement

Voir [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) pour la procédure de déploiement
sur Vercel. La CI (`.github/workflows/ci.yml`) exécute lint, tests unitaires et
build à chaque push/PR.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Base de données](docs/DATABASE.md)
- [Sécurité](docs/SECURITY.md)
- [Déploiement](docs/DEPLOYMENT.md)
- [Produit & MVP](docs/PRODUCT.md)

## Structure

```
app/          Routes et pages (App Router)
components/   Composants UI (shadcn/ui + métier)
lib/          Logique serveur, actions, accès aux données
hooks/        Hooks React
types/        Types métier et base de données
supabase/     Migrations SQL et seed
tests/        Tests unitaires (Vitest) et E2E (Playwright)
public/       Assets statiques, service worker, icônes PWA
```