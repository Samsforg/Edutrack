# Base de données

Schéma PostgreSQL + RLS pour EduTrack, appliqué via `supabase/migrations/`
et consolidé dans `docs/db-bootstrap.sql` (exécutable dans l'éditeur SQL du
dashboard Supabase).

## Migrations

| Fichier | Contenu |
| ------- | ------- |
| `20250401000000_init.sql` | extensions, enums, `profiles`, trigger `handle_new_user` |
| `20250401000001_tables.sql` | tables métier + index + triggers `updated_at` |
| `20250401000002_helpers.sql` | fonctions d'autorisation (`is_*`, `parent_of_student`, …) |
| `20250401000003_rls.sql` | activation RLS + politiques sur toutes les tables |
| `20250401000004_functions.sql` | RPC liaison initiaux (`resolve_link_code`, `create_link_request`, `set_link_request_status`) |
| `20250401000005_rls_harden.sql` | durcissement lecture parents (children only) |
| `20250401000006_fix_parent_of_student.sql` | `parent_of_student` lié à `auth.uid()` |
| `20250401000007_fix_notifications_rls.sql` | staff peut notifier les parents |
| `20250401000008_fix_members_recursion.sql` | récursion `school_members` + `members_select_own` |
| `20250401000009_school_management.sql` | gestion d'établissement : `students.status`, contacts `schools`, `academic_years.is_current` (1 seule année courante), `subjects.code` unique, `teachers.is_active`, triggers d'intégrité inter-écoles |
| `20250401000010_school_admin_update_policy.sql` | un `SCHOOL_ADMIN` peut mettre à jour sa propre école (contacts) |
| `20250401000011_secure_parent_linking.sql` | **Liaison sécurisée** : table `student_link_codes` (hash SHA-256 salé, jamais en clair), rate limiting `link_code_attempts` + `attempt_slowdown`, RPC `verify_link_code` / `create_link_request` / `resolve_link_request`, évolution `student_link_requests` (drop `code`, ajout `link_code_id`, `resolved_by/at`, `reason`), politiques RLS strictes |
| `20250401000012_drop_students_link_code.sql` | suppression de la colonne obsolète `students.link_code` |

> Les migrations sont **dans l'ordre** : certaines fonctions SQL sont validées à
> la création et exigent que les tables existent (table → helpers → rls).

## Tables principales

- `profiles` — étend `auth.users` (nom, téléphone, avatar).
- `schools`, `academic_years`, `classes`, `subjects`, `class_subjects`.
- `school_members` — rôles multi-tenant (`SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`,
  `PARENT`).
- `teachers`, `students`, `parents`, `student_parents` (liaison enfant-parent).
- `attendance`, `grades`, `announcements`, `notifications`.
- `student_link_codes` — codes de liaison hachés (jamais en clair), `code_salt` +
  `code_hash`, `expires_at` (7 j), `revoked_at`, `used_at`, créé par l'admin.
- `link_code_attempts` — compteur anti brute-force (rate limiting).
- `student_link_requests` — demandes de liaison (via `link_code_id` → élève → parent).

## Enums

`user_role`, `school_status`, `attendance_status`, `notification_type`,
`link_request_status`, `announcement_audience`, `student_status`
(`active`, `inactive`, `graduated`, `transferred`).

## Colonnes ajoutées par la 0009

- `schools.email/phone/address/city/country` — coordonnées de contact.
- `academic_years.is_current` (ex-`is_active`) — année courante, avec index
  unique partiel `(school_id) WHERE is_current` : une seule année courante par école.
- `subjects.code` (backfill `S001`…) — index unique partiel `(school_id, code)`.
- `students.status` (défaut `active`) — cycle de vie + index `(school_id, status)`.
- `teachers.is_active` (défaut `true`) — désactivation sans suppression +
  index `(school_id, is_active)`.

## Triggers d'intégrité inter-écoles (0009)

Fonctions `security definer` en `search_path = public` empêchant une école de
référencer un enregistrement d'une autre école :

- `classes` → `academic_year_id` de la même école.
- `class_subjects` → classe, matière et enseignant de la même école.
- `students` → classe de la même école.
- `student_parents` → élève et parent de la même école.

Ces triggers complètent la RLS (prévention des incohérences défensives pour le
code privilégié tel que le service role).

## RPC (flux de liaison)

Un parent ne sélectionne jamais `students` librement ; il passe par des RPC
`security definer` (migration `0011`) :

- `verify_link_code(code)` → vérifie un code actif et retourne une confirmation
  **minimale** (prénom, nom, école — jamais le matricule ni la classe).
- `create_link_request(code)` → vérifie + **consomme** le code atomiquement
  (`used_at`) + crée/garantit la ligne `parents` liée à `auth.uid()` + crée la
  demande `pending` (rejette `CODE_NOT_FOUND` / `PENDING_EXISTS` / `RATE_LIMITED`).
- `resolve_link_request(request_id, status, reason)` → approbation/rejet/annulation
  atomique (admin approuve/rejette, parent annule sa propre demande `pending`),
  crée `student_parents` + rattache le rôle `PARENT`.
- `attempt_slowdown()` → RPC interne de rate limiting (`link_code_attempts`, ~10
  essais / 5 min).

Anciens RPC (`resolve_link_code`, `set_link_request_status`) **supprimés** dans la
`0011`.

## Seed

```bash
npm run db:seed
```

Crée l'« Établissement Démo EduTrack » (classes, élèves, enseignants, parents,
présences, notes, annonces) + un super-admin de test. Idempotent.

## Comptes démo

Voir le tableau dans le [README](../README.md) (`@demo.edutrack`).
