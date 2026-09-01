# Architecture

EduTrack — SaaS multi-tenant de suivi scolaire : présences, notes, annonces et
liaison parent-élève en quasi temps réel.

## Stack

- **Next.js 16** (App Router, RSC, `proxy.ts` pour l'auth — pas de `middleware`).
- **Supabase** pour Auth, base PostgreSQL (RLS), Realtime et PostgREST.
- **shadcn/ui + Tailwind**, **PWA** (`public/manifest.webmanifest`, service worker).
- **Vitest** (unitaires RPC/RLS) + **Playwright** (E2E).

## Structure

```
app/<public>           Landing, login, signup, auth/callback
app/app/<role>         Espaces authentifiés (parent, teacher, admin, super-admin)
components/ui          shadcn/ui
components/live        Realtime (présences live, cloche de notifications)
lib/auth               Session, guards, sign in/out
lib/supabase           Clients server/client/proxy (SSR)
lib/db                 Accès aux données + métier (juxtaposés par domaine)
lib/actions            Server Actions métier (annotations, import, liaison…)
supabase/migrations    Schéma + RLS (horodaté, classé dans l'ordre)
supabase/seed.ts       Données de démo (idempotent)
tests/                 unit (srcVitest) + e2e/ (Playwright)
docs/                  Documentation produit/tech
```

## Routage par rôle

Chaque espace sécurisé utilise `requireRole([...])` (voir `lib/auth/guard.ts`) qui
redirige selon la fonction `roleHome()` calculée depuis `school_members`
(`SUPER_ADMIN` > `SCHOOL_ADMIN` > `TEACHER` > `PARENT`).

## Flux principaux

1. **Liaison parent** : l'école génère un `link_code` par élève. Le parent saisit
   le code → RPC `create_link_request` (jamais de SELECT direct sur `students`) →
   l'admin approuve → `student_parents` est créé.
2. **Prise d'appel** : l'enseignant choisit sa classe → enregistre les statuts →
   écriture dans `attendance` (RLS limité à sa classe) → notification aux parents
   concernés (Realtime).
3. **Annonces** : l'admin crée une annonce (école ou classe) → notification aux
   parents via la cloche.

## RLS & multi-tenant

Détaillé dans `SECURITY.md` + `DATABASE.md`. Aucune requête serveur ne contourne
RLS par défaut (client anon + JWT de session). Les RPC `security definer`
n'exposent que des opérations étroites.

## Temps réel

`supabase/` Realtime broadcast/subscribe sur les tables utilsées par les pages
parent (présences) et la cloche de notifications (`components/live/*`).
