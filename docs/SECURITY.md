# Sécurité & RLS

EduTrack est un SaaS multi-tenant : un utilisateur ne peut **jamais** accéder aux
données d'une autre école, et un parent ne peut consulter que les données de **ses
propres enfants**.

## Modèle de confiance

- **Connexion** : toutes les requêtes passent par Supabase Auth (JWT).
- **RLS** : chaque table a le `row level security` activé et des politiques
  `to authenticated`.
- **Aucune donnée sensible n'est exposée** : les parents n'ont pas de droit global
  sur les élèves, présences, notes ou demandes de liaison.

## Helpers `security definer`

Pour éviter de dupliquer la logique dans les politiques et pour lire des tables
sans déclencher de récursion, on utilise des fonctions **SECURITY DEFINER** :
`is_school_member`, `is_admin_of_school`, `is_super_admin`, `parent_of_student`,
`is_school_non_parent_member`, `is_school_parent_member`,
`staff_can_notify_parent`.

Les RPC de liaison (`verify_link_code`, `create_link_request`,
`resolve_link_request`, `attempt_slowdown`) sont elles aussi `security definer`
`set search_path = public, pg_temp` et **schema-qualifient** les appels
(`public.*`, `extensions.digest`) pour se prémunir des collisions de `search_path`.

> ⚠️ Une fonction `security definer` lit les tables **sans** leurs politiques RLS.
> C'est volontaire pour la vérification d'autorisation, mais elle doit être
> écrite avec un `set search_path` explicite.

## Isolation des rôles (vérifiée sur backend réel)

| Opération                                             | Résultat |
| ----------------------------------------------------- | -------- |
| Un parent lit les enfants d'un autre parent           | bloqué   |
| Un parent lit les élèves de toute l'école             | bloqué   |
| Un parent écrit une présence / note / annonce         | bloqué   |
| Un enseignant prend l'appel **dans sa classe**        | autorisé |
| Un enseignant prend l'appel **hors de sa classe**     | bloqué   |
| Un admin crée une annonce, modifie un élève           | autorisé |
| Un admin modifie sa propre école (contacts)           | autorisé |
| Un admin modifie une **autre** école                  | bloqué   |
| Un enseignant crée une annonce / gère des membres     | bloqué   |
| Un super-admin voit toutes les écoles / élèves        | autorisé |

## Liaison parent-élève par code (migration 0011)

Le flux de liaison (code → demande → approbation) est conçu pour ne jamais
exposer un identifiant scolaire brute.

- **Hash, jamais de clair** : `students.link_code` a été supprimé. Un code est
  stocké dans `student_link_codes` sous la forme `code_salt` (aléatoire, 16
  octets) + `code_hash = sha256(code_salt || code_normalisé)`. L'égalité est
  indexable en SQL pur. Un parent ne peut jamais lire `student_link_codes`
  (RLS réservée à l'admin/super-admin).
- **Chiffre aléatoire** : format `EDU-XXXX-XXXX`, alphabet de 32 caractères sans
  biais de modulo (~80 bits d'entropie).
- **Garanties du code** : expiration 7 jours (`expires_at`), usage unique
  (`used_at`), révocation (`revoked_at`) ; index unique partiel `uq_link_codes_active_student`
  (un seul code actif par élève).
- **Rate limiting** : `link_code_attempts` + `attempt_slowdown()` (~10 essais /
  5 min), table RLS activée **sans** politique (seul un definer écrit).
- **Aucune fuite d'identifiant** : `verify_link_code` retourne uniquement
  prénom/nom/école ; ni matricule (`matricule`) ni `classroom_id`.
- **Approbation réservée au staff** : `student_link_requests` a une politique
  `link_requests_update_admin_only` — un parent ne peut **pas** basculer sa
  propre demande en `approved` (testé). Il ne peut annuler que sa demande
  `pending`.
- **Isolation stricte** : les politiques de `student_link_requests` restreignent
  la lecture à `parents.user_id = auth.uid()` (même école) et l'administration
  à l'admin de l'école ; un admin d'une autre école ne voit ni ne traite rien.

## Politiques ajoutées par la 0009 / 0010 (gestion d'établissement)

- `schools` : `schools_admin_update_own` (0010) — un `SCHOOL_ADMIN` peut
  `UPDATE` sa propre école ; `schools_admin_write` reste réservée à
  `SUPER_ADMIN`.
- `academic_years`, `subjects`, `teachers` : les insertions/modifications sont
  scoped par `school_id` (résolu côté serveur, jamais depuis le navigateur).
- Contraintes d'unicité **par école** (index partiels) pour `subjects.code` et
  une seule `academic_years.is_current` par école.

## Intégrité inter-écoles (triggers `security definer`)

La RLS protège les lectures/écritures par rangée ; elle ne couvre pas les accès
privilégiés (service role) ni les incohérences de clés étrangères entre écoles.
La migration `0009` ajoute des triggers `assert_*_same_school` (classes,
class_subjects, students, student_parents) qui **rejettent** toute écriture
référençant un enregistrement d'une autre école (classe, année, matière,
enseignant, élève, parent).

## Présence & notifications (Phase 4, migration 0013)

- **Trigger `assert_attendance_same_school`** : tout relevé dont l'école ou la
  classe diffère de celle de l'élève est **rejeté**, y compris via le service
  role (défense en profondeur au-delà de la RLS).
- **RLS `attendance`** : SELECT = super-admin / parent de l'élève / membre non
  parent de l'école ; écriture (`attendance_write`) = admin de l'école de
  l'élève ou enseignant affecté. Un parent est strictement en lecture seule.
- **RLS `notifications`** : `notifications_own` confine à `user_id = auth.uid()`
  ; l'insertion est réservée au staff de la même école (`staff_can_notify_parent`).
  Une autre école ne peut pas notifier un parent étranger.
- **Realtime sécurisé** : les souscriptions `postgres_changes` sont filtrées et
  RLS-scopées ; aucun canal public. La publication `supabase_realtime` ne couvre
  que `attendance` et `notifications`.

Vérification automatisée sur le backend réel (14 assertions) :

```bash
npx tsx scripts/attendance-security-check.ts
```

Entre autres : un parent lié lit son enfant (R1), un tiers et un parent d'une
autre école ne lisent ni n'écrivent (R2/R5/R6/R7), un parent n'écrit ni ne
supprime (R3/R12), l'admin écrit (R4), le trigger refuse une école étrangère
(R8), les notifications sont scopées/non falsifiables (R9-R11).

## Notes, évaluations & annonces (Phase 5, migration 0014)

- **Nouvelles tables** : `academic_periods` et `assessments` (évaluation :
  école, classe, matière, enseignant, **période**, barème, `published`).
- **Nouvelles colonnes `grades`** : `assessment_id` (nullable — note
  structurée), `published_at` (nullable — brouillon), `graded_by`.
- **Nouvelles colonnes `announcements`** : `published_at` / `archived_at`
  (cycle brouillon → publiée → archivée).
- **Helpers `security definer`** : `user_teaches_subject_in_class`
  (l'enseignant doit être rattaché à la classe **et** à la matière via
  `class_subjects`), `user_may_grade_assessment`, `assert_assessment_same_school`,
  `assert_academic_period_same_school` (triggers cross-école).
- **RLS `grades`** : SELECT = super-admin / membre non parent de l'école /
  **parent de l'élève uniquement sur les notes publiées** ; écriture = admin de
  l'école de l'élève ou enseignant autorisé sur l'évaluation.
- **RLS `assessments`** : SELECT = super-admin / admin / enseignant de la
  classe+matière / parent (publiées de la classe de son enfant) ; écriture =
  admin ou enseignant autorisé.
- **RLS `announcements`** : SELECT = super-admin / membre non parent de l'école
  / parent **uniquement sur les publiées non archivées** (école entière ou
  classe cible) ; écriture = admin de l'école ou super-admin.
- **Écriture enseignante via serveur** : un enseignant ne choisit jamais
  librement une évaluation ou une classe : les server actions vérifient le rôle,
  l'adhésion à l'école, puis la RLS confirme `user_teaches_subject_in_class`.

Vérification automatisée sur le backend réel (16 assertions) :

```bash
npx tsx scripts/grades-security-check.ts
```

Couverture : parent lié → note publiée OK / brouillon interdit (G1/G1b), autre
parent → rien (G2), parent → écriture bloquée (G3), admin lit brouillons (G4),
**autre école** → lectures et écritures bloquées sur notes, évaluations,
périodes et annonces (G5-G7/A2/P1b/N3), père ne lit que les évaluations
publiées (A1), annonces brouillon invisibles au parent (N1), parent ne crée pas
d'annonce (N2), admin lit les brouillons (N4).

## Fuites corrigées pendant le développement

1. **`parent_of_student`** (migration `0006`) : initialement scopé à l'école, il
   laissait un parent voir les enfants de **tous** les parents de l'école. Il est
   désormais lié à `auth.uid()`.
2. **Lecture parents** (migration `0005`) : `students`/`attendance`/`grades`
   autorisaient tout membre d'école (y compris PARENT). Les parents passent
   désormais uniquement par `parent_of_student`.
3. **Récursion infinie `school_members`** (migration `0008`) : un `not exists`
   inline dans une politique sur `school_members` causait `42P17` et cassait le
   login. Déplacé dans un helper definer + policy `members_select_own`.
4. **Notifications** (migration `0007`) : `notifications_own` empêchait le staff
   de notifier les parents (`42501`). Ajout d'une policy d'insertion via
   `staff_can_notify_parent`.
5. **Code en clair** (migration `0011`) : le code de liaison était stocké en
   clair dans `students.link_code` et renvoyé par RPC. Remplacé par un hash
   salé dans `student_link_codes` et une confirmation minimale (`verify_link_code`).
6. **Approbation parent** (migration `0011`) : un parent aurait pu forcer
   `status = approved` via UPDATE RLS. Réservé au staff
   (`link_requests_update_admin_only`).
7. **Index partiel sur `grades (assessment_id, student_id)`** : `WHERE
   assessment_id IS NOT NULL` empêchait `ON CONFLICT` (upsert de la saisie).
   Corrigé en index unique **non partiel** (les NULL restent distincts).
8. **Embed PostgREST `subject(name)`** invalide dans `getAssessmentsForClassSubject` :
   le nom de ressource embarquée est `subjects`. Corrigé en
   `subject:subjects(name)` — sinon liste d'évaluations vide silencieuse.
9. **Fichier `"use server"` exportant un objet** (`assessmentSchema`/`batchGradesSchema`) :
   Next 16 rejette tout export non-fonction asynchrone → l'action `createAssessment`
   échouait en 500 côté serveur (bouton « Création… » bloqué). Les schémas Zod
   sont désormais privés dans le module.

## Recommandations

- Ne jamais étendre une politique à `authenticated` sans rôle.
- Ré-exécuter `docs/db-bootstrap.sql` ou `supabase db push` sur un env vierge et
  passer `npm run test:e2e`.
