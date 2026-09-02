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
| `20250401000013_attendance_live_and_realtime.sql` | **Présence (Phase 4)** : colonnes `attendance.check_in/check_out/updated_by`, trigger inter-écoles `assert_attendance_same_school`, index `(classroom_id, attendance_date)` + `(student_id, attendance_date)`, **Realtime** : tables `attendance` + `notifications` ajoutées à la publication `supabase_realtime` |
| `20250401000014_academic_assessments_grades_periods.sql` | **Notes & évaluations (Phase 5)** : tables `academic_periods` + `assessments` (période NOT NULL, `published`), colonnes `grades.assessment_id` (note structurée) / `published_at` (brouillon→publiée) / `graded_by`, colonnes `announcements.published_at` / `archived_at` (cycle brouillon→publiée→archivée), index unique **non partiel** `uq_grades_assessment_student` (upsert `ON CONFLICT`), helper `user_teaches_subject_in_class` / `user_may_grade_assessment` / triggers `assert_assessment_same_school` + `assert_academic_period_same_school`, réécriture des RLS `grades` + `announcements`, nouvelles politiques `assessments_select` / `assessments_admin_teacher_write` / `academic_periods_select` / `academic_periods_admin_write` |

> Les migrations sont **dans l'ordre** : certaines fonctions SQL sont validées à
> la création et exigent que les tables existent (table → helpers → rls).

## Tables principales

- `profiles` — étend `auth.users` (nom, téléphone, avatar).
- `schools`, `academic_years`, `classes`, `subjects`, `class_subjects`.
- `school_members` — rôles multi-tenant (`SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`,
  `PARENT`).
- `teachers`, `students`, `parents`, `student_parents` (liaison enfant-parent).
- `attendance`, `grades`, `announcements`, `notifications`.
- `academic_periods` (Phase 5) — périodes scolaires (`is_current`, une seule par
  école via index partiel).
- `assessments` (Phase 5) — évaluations rattachées à école/classe/matière/
  enseignant/**période**, barème `max_score`, `coefficient`, `published`.
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

## Prise de présence (0013)

- **Colonnes** : `attendance.check_in`, `attendance.check_out` (horaires
  facultatifs — pertinents pour les retards), `attendance.updated_by`
  (utilisateur de la dernière modification, complète l'audit `taken_by`).
- **Trigger `assert_attendance_same_school`** (`before insert or update`,
  `security definer` en `search_path = public`) : l'école et la classe du
  relevé doivent correspondre à celles de l'élève. Empêche toute écriture
  cross-école même via le service role.
- **Index** : `(classroom_id, attendance_date)` et `(student_id, attendance_date)`
  pour l'appel du jour d'une classe et l'historique/les stats d'un élève.
- Contrainte `UNIQUE(student_id, attendance_date)` (héritée) : un seul relevé
  par élève et par jour ; les appels sont **idempotents** (`ON CONFLICT`).

## Notes & évaluations (0014)

- **Tables** : `academic_periods` (`school_id`, `academic_year_id`, `name`,
  `type`, `start_date`, `end_date`, `is_current` — index partiel `(school_id)
  WHERE is_current`) et `assessments` (`school_id`, `class_id`, `subject_id`,
  `teacher_id`, `academic_period_id` **NOT NULL**, `title`, `description`,
  `max_score`, `coefficient`, `assessment_date`, `published`).
- **Colonnes `grades`** : `assessment_id` (nullable — note liée à une
  évaluation), `published_at` (nullable — brouillon), `graded_by`.
- **Index unique `uq_grades_assessment_student (assessment_id, student_id)`**
  **non partiel** : un seul score par élève et par évaluation, upsert
  `ON CONFLICT (assessment_id, student_id)` pour la saisie et le seed (les NULL
  restent distincts en B-tree → compatibles avec les anciennes notes plates).
- **Colonnes `announcements`** : `published_at` / `archived_at` (une annonce
  publiée a `published_at` non nul ; archivée → `archived_at` non nul).
- **Triggers inter-écoles** `security definer` : `assert_assessment_same_school`
  (école, classe, matière et période d'une même école) et
  `assert_academic_period_same_school`.
- **Helper** `user_teaches_subject_in_class(class_id, subject_id)` : vrai si
  l'utilisateur est rattaché à la classe **et** à la matière via `class_subjects`
  (utilisé par les politiques et le déclencheur `user_may_grade_assessment`).

## Realtime (0013)

La publication `supabase_realtime` contient désormais `attendance` et
`notifications`. Les souscriptions client utilisent `postgres_changes` avec un
filtre par abonné ; la RLS filtre les événements (aucun Realtime public).

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

En Phase 5 il ajoute aussi : 2 périodes (Trimestre 1 courant / Trimestre 2),
6 évaluations publiées « Contrôle n°1 » + 6 brouillons « Devoir (brouillon) »
(Maths + Français × 3 classes), **36 notes structurées publiées** et des
annonces publiées déterministes.

## Comptes démo

Voir le tableau dans le [README](../README.md) (`@demo.edutrack`).
