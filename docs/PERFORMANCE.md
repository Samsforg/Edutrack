# Performance — Phase 6

Optimisations d'indexation, de pagination et d'accès aux données pour passer à
l'échelle du pilote (quelques dizaines d'élèves) et au-delà.

## Index ajoutés (migration `0015`)

Index pour accélérer les requêtes les plus fréquentes (jointures, filtres par
école, recherche, tri, notifications) :

```
idx_grades_student_id          idx_grades_classroom_id
idx_grades_subject_id          idx_grades_assessment_id
idx_attendance_school_date     idx_assessments_class_subject
idx_assessments_school         idx_assessments_period
idx_announcements_school_published
idx_announcements_classroom    idx_school_members_user_school
idx_student_parents_parent     idx_student_parents_student
idx_notifications_user_created
```

> `idx_profiles_user_id` a été **retiré** : la table `profiles` n'a pas de colonne
> `user_id` (sa PK `id` est déjà indexée).

## Analytics en SQL (migration `0016`)

Les agrégations (KPIs, assiduité, moyennes) sont passées de « chargement en
mémoire + calcul côté client » à des **vues SQL agrégeant en base** :
`school_kpis`, `class_attendance_stats`, `student_attendance_stats`,
`school_grade_stats`. `security_invoker` respecte les RLS.

## Pagination & recherche

- **Élèves** : `listStudents` est déjà paginé (`PAGE_SIZE = 50`) + recherche
  (`lib/db/students.ts`).
- **Parents** : corrigation du **N+1** dans `listParentsDetail` — une **seule**
  requête batched sur `student_parents` (au lieu d'une requête par parent).
- **Limites d'export** : `LIMIT = 10_000` sur tous les exports CSV.

## Bonnes pratiques appliquées

- Pagination (`limit`/`offset`) partout où une liste peut grandir.
- Filtre `school_id` sur chaque requête analytique/rapport.
- Server Actions côté serveur (pas de données brutes au client).
- Réutilisation du type lit de la base de données (`types/database.ts`).

## Mesures cibles (pilote)

- En dessous de ~50 élèves : latence de page < 100 ms (hors réseau).
- Dashboard admin : 1 requête par KPI via vue, aucun chargement de table complète.
- Imports par lots de 200 lignes : insensible au nombre total de lignes du fichier.
