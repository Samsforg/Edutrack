# Moyennes

Les moyennes sont calculées à partir des **notes publiées uniquement** — un
brouillon n'influence jamais un élève ni une classe.

## Définition

La moyenne d'un élève d'une matière (pondérée par coefficient) est :

```
moyenne = Σ(score/barème × coefficient) / Σ coefficient
```

- Notes **à trou** (le `score` seul, types d'école française) : barème fixe 20.
- Les deux formes (note directement sur 20, ou `score/max_score`) sont
  supportées par `computeAverages` selon les champs fournis.

## Pureté & tests

La logique est **pure** et extraite dans `lib/db/academic.ts` :

- `computeAverages(grades)` — moyennes par matière d'un élève (fonction pure) ;
- `computeClassAverages(...)` — moyennes par matière d'une classe ;

Ces fonctions sont testées unitairement (`tests/unit/academic.test.ts`, 9
tests : pondération, matières absentes → `null`, brouillons ignorés, barèmes
multiples, classe vide). Elles sont réutilisées par
`getStudentAverages(studentId)` et `getSchoolAverages(schoolId)` (couche
Supabase en lecture seule autour des pures).

## Affichages

- **Parent** : `/app/parent/children/[id]/grades` puis par matière
  (`…/grades/[subjectId]`) — notes publiées + moyenne de la matière.
- **Dashboard admin** : carte « Performances académiques »
  (`getSchoolAverages`) — moyennes par matière de l'école.
- **Dashboard enseignant** : statistiques agrégées (classes, évaluations en
  brouillon, notes publiées).

## Liens

- [Notes](./GRADES.md) · [Évaluations](./ASSESSMENTS.md) ·
  [Sécurité & RLS](./SECURITY.md)