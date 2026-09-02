# Notes (grades)

Depuis la Phase 5, une note peut être **plate** (historique, liée à une matière)
ou **structurée** (liée à une évaluation). La publication est explicite : un
parent ne voit **que** les notes publiées (`published_at` non nul).

## Modèle

Table `public.grades` :

| Colonne | Description |
| ------- | ----------- |
| `id` | uuid |
| `student_id` | élève noté |
| `subject_id` | matière (flat), ou matière de l'évaluation |
| `classroom_id` | classe de l'élève (dénormalisée) |
| `score` / `max_score` / `coefficient` | note, barème, pondération |
| `grade_date` | date de la note |
| `comment` | appréciation (optionnelle) |
| `assessment_id` | `null` pour une note plate, sinon l'évaluation source |
| `published_at` | `null` = brouillon (invisible parent) ; sinon publication |
| `graded_by` | utilisateur qui a saisi la note |

Contrainte d'unicité `uq_grades_assessment_student` (migration 0014) : une seule
note par `(assessment_id, student_id)`. L'index est **non partiel** afin de
permettre les `ON CONFLICT (assessment_id, student_id)` (saisie + seed
idempotents) ; en B-tree les `NULL` restent distincts, donc les anciennes notes
plates (sans `assessment_id`) sont compatibles.

## Publication

- Une note structurée créée via la grille de saisie est enregistrée en
  **brouillon** (`published_at` nul).
- `publishGrades(assessmentId)` (server action, `lib/actions/academic.ts`) :
  1. passe l'évaluation à `published = true` ;
  2. pose `published_at` sur **toutes** ses notes non publiées (batch) ;
  3. notifie chaque parent lié des élèves concernés
     (`notification.type = "grade"`, idempotent — pas de doublon par
     évaluation + destinataire).

## RLS

- **SELECT** (`grades_select`, migration 0014) : super-admin, membre non-parent
  de l'école, ou **parent de l'élève uniquement si `published_at` non nul**.
- **UPDATE/INSERT/DELETE** (`grades_write`) : admin de l'école de l'élève, ou
  enseignant autorisé sur l'évaluation (`user_may_grade_assessment`).

## Vérification automatisée (backend réel)

```bash
npx tsx scripts/grades-security-check.ts
```

16 assertions : un parent lié lit une note publiée (G1) mais pas un brouillon
(G1b), un autre parent ne lit rien (G2), un parent n'écrit jamais (G3), l'admin
lit brouillons inclus (G4), une autre école ne lit ni n'écrit (G5/G6/G7), etc.

## Liens

- [Évaluations](./ASSESSMENTS.md) · [Moyennes](./AVERAGES.md) ·
  [Sécurité & RLS](./SECURITY.md) · [Base de données](./DATABASE.md)