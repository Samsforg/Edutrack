# Évaluations & périodes

Les évaluations (`assessments`) sont le support des notes structurées. Chaque
évaluation appartient à une école, une classe, une matière, un enseignant et une
**période** (`academic_periods`), et porte un barème + coefficient.

## Modèle

Table `public.assessments` :

| Colonne | Description |
| ------- | ----------- |
| `school_id` / `class_id` / `subject_id` / `teacher_id` | rattachements (même école, vérifié par triggers) |
| `academic_period_id` | période (Trimestre 1, …) — **NOT NULL** |
| `title` / `description` | intitulé et consigne |
| `max_score` / `coefficient` | barème et pondération |
| `assessment_date` | date de l'évaluation |
| `published` | l'évaluation (et ses notes) est publiée aux parents |

Table `public.academic_periods` :

| Colonne | Description |
| ------- | ----------- |
| `school_id` / `academic_year_id` | rattachements |
| `name` / `type` | ex. « Trimestre 1 », `trimester` |
| `start_date` / `end_date` | bornes |
| `is_current` | période courante (une seule par école, index partiel) |

## Parcours enseignant

1. **Sélecteurs** (`/app/teacher/grades?class=&subject=&period=`) : la page
   expose Année, Classe (présélectionnée via le lien du dashboard),
   Matière (résolue par les `class_subjects` **de l'enseignant connecté**) et
   Période.
2. **Nouvelle évaluation** : le dialogue pré-remplit la période
   (`defaultPeriodId` = période paramétrée, sinon l'unique, sinon la courante).
   `createAssessment` insère (RLS enseignant/admin), puis redirige vers
   `/app/teacher/grades/:id`.
3. **Grille de saisie** : liste des élèves de la classe avec saisie note
   (0…`max_score`, pas 0.25) + commentaire. `saveClassGrades` fait un upsert
   par `(assessment_id, student_id)` → **idempotent**. Deux boutons :
   « Enregistrer (brouillon) » et « Enregistrer et publier ».

## RLS

- `assessments_select` : super-admin, admin de l'école, enseignant de la
  classe+matière (`user_teaches_subject_in_class`) ou **parent ne lisant que les
  évaluations publiées** de la classe de son enfant.
- `assessments_admin_teacher_write` : admin de l'école ou enseignant autorisé
  (INSERT/UPDATE/DELETE).

Fonctions helper : `user_teaches_subject_in_class(class_id, subject_id)`,
`user_may_grade_assessment(assessment_id)`,
`assert_assessment_same_school`, `assert_academic_period_same_school`
(triggers `security definer`).

## Vérification

RLS : `npx tsx scripts/grades-security-check.ts` (A1 : un parent ne lit que les
publiées ; A2 : un admin d'une autre école ne lit rien). E2E :
`tests/e2e/phase5-grades.spec.ts`.

## Liens

- [Notes](./GRADES.md) · [Moyennes](./AVERAGES.md) ·
  [Sécurité & RLS](./SECURITY.md) · [Base de données](./DATABASE.md)