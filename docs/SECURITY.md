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
`staff_can_notify_parent`, et les RPC `resolve_link_code`,
`create_link_request`, `set_link_request_status`.

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

## Recommandations

- Ne jamais étendre une politique à `authenticated` sans rôle.
- Ré-exécuter `docs/db-bootstrap.sql` ou `supabase db push` sur un env vierge et
  passer `npm run test:e2e`.
