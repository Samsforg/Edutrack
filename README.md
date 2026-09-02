# EduTrack

> Le lien intelligent entre l'école et la famille.

[![CI](https://github.com/Samsforg/Edutrack/actions/workflows/ci.yml/badge.svg)](https://github.com/Samsforg/Edutrack/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white)

EduTrack est un SaaS EdTech B2B2C qui permet aux établissements scolaires de
communiquer avec les parents et de leur fournir un suivi quasi temps réel de la
scolarité de leurs enfants : présences, absences, retards, **notes structurées
et moyennes**, annonces et notifications.

EduTrack est un projet **totalement indépendant** et ne partage ni code, ni
base de données, ni utilisateurs, ni dépendance technique avec Edukora.

## Fonctionnalités

- **Espace parent** : portail dédié — dashboard « Bonjour », enfants liés, détail enfant protégé par RLS, liaison par code en 2 étapes.
- **Espace enseignant** : prise d'appel par classe (date, 4 statuts, retard → heure d'arrivée, note, appel partiel), historique des appels, tableau de bord « Mes classes » avec statut appel, **saisie des notes** : sélecteurs classe/matière/période, création d'évaluations (barème, coefficient, période), grille de saisie, enregistrement en brouillon ou **publication avec notification aux parents**.
- **Espace parent** : dashboard « Aujourd'hui » **en direct** (Realtime), suivi d'assiduité (taux + journal + filtres), notifications d'absence/retard, **notes publiées d'un enfant avec moyennes par matière**, **annonces de l'établissement et de la classe**.
- **Espace admin école** : gestion élèves (statuts), enseignants (activation), classes (année scolaire), matières (codes uniques), années scolaires (1 seule courante), répertoire parents, paramètres de l'établissement, **annonces (brouillon → publiée → archivée, notification des parents)**, **aperçu des performances académiques (moyennes par matière)**, approbation des liaisons parent-enfant, import CSV, analytique.
- **Espace super-admin** : vue plateforme, création d'établissements.
- **Liaison parent-enfant par code sécurisée** : codes hachés (SHA-256 salé, jamais en clair), expiration 7 j, usage unique, révocation, rate limiting, demande → approbation/rejet par l'école.
- **Notes structurées & moyennes** : évaluations par période (Trimestre 1/2), publication explicite des notes (brouillon ≠ publiée), moyennes pondérées par matière (élève, classe, école), calcul **pur** testé unitairement.
- **Sécurité multi-tenant** : Row Level Security (PostgreSQL), isolation stricte des données par école et par rôle, trigger d'intégrité inter-écoles sur la présence, les évaluations et les périodes.
- **Temps réel** : présence et notifications livrées en direct via Supabase Realtime (Postgres Changes), RLS-scopé par abonné — sans polling.

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
3ème A), des élèves, 2 enseignants, 3 parents, des présences, des annonces, et
en Phase 5 : 2 périodes (Trimestre 1/2), 12 évaluations (6 publiées dont
« Contrôle n°1 », 6 brouillons) et **36 notes structurées publiées**.

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

Vérification RLS sur le backend réel (autorisations multi-tenant) :

```bash
npx tsx scripts/parent-linking-security-check.ts
npx tsx scripts/attendance-security-check.ts
npx tsx scripts/grades-security-check.ts
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
- [Authentification & autorisation](docs/AUTH.md)
- [Liaison parent-élève par code](docs/PARENT_LINKING.md)
- [Prise de présence](docs/ATTENDANCE.md)
- [Notes & publication](docs/GRADES.md)
- [Évaluations & périodes](docs/ASSESSMENTS.md)
- [Moyennes](docs/AVERAGES.md)
- [Annonces](docs/ANNOUNCEMENTS.md)
- [Realtime](docs/REALTIME.md)
- [Notifications](docs/NOTIFICATIONS.md)
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