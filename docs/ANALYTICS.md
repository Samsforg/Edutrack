# Analytics — Phase 6

Module statistiques du tableau de bord admin, accessible au `SCHOOL_ADMIN`
uniquement (`/app/admin/analytics`).

## Vue d'ensemble

Le module expose des **Indicateurs Clés de Performance (KPI)**, l'**assiduité** et
les **performances académiques**, agrégés côté base de données via des vues SQL.

> La logique d'agrégation **ne se fait plus en mémoire client** : elle repose sur
> des vues agrégeant en base (performant à l'échelle).

## Indicateurs

- **Effectifs** : élèves actifs, classes, enseignants actifs, parents connectés.
- **Assiduité (30 jours)** : taux de présence, absences, retards, absences
  justifiées — et la **tendance quotidienne** (présents/retards/excusés/absents).
- **Académique** : moyennes normalisées `/100` par **matière** et par **classe**.
- **Assiduité par classe** : taux de présence sur 30 jours.

## Vues SQL (migration `0016`)

Toutes les vues sont `SECURITY INVOKER` — elles respectent les RLS des tables
sous-jacentes — **et** restreintes aux administrateurs via
`is_admin_of_school(school_id)` (fonction `security definer`). Un parent ou un
admin d'une autre école **ne peut pas** lire ces vues.

| Vue | Rôle | Colonnes clés |
|-----|------|---------------|
| `school_kpis` | Effectifs par école | student_count, class_count, teacher_count, linked_parent_count |
| `class_attendance_stats` | Assiduité par classe | recorded, present, absent, late, excused |
| `student_attendance_stats` | Assiduité par élève | recorded, present, absent, late, excused |
| `school_grade_stats` | Notes par matière/classe | grade_count, student_count, avg_norm |

`avg_norm` est une moyenne **normalisée sur 100** (`score / max_score * 100`),
ce qui rend les matières comparables quel que soit le barème.

## Couche d'accès

`lib/db/analytics.ts` fournit (`lib/db/server` + RLS) :
- `getSchoolKpis(schoolId)`
- `getAttendanceTrend(schoolId, days)`
- `getClassAttendanceRates(schoolId, days)`
- `getSubjectAverages(schoolId)`
- `getClassAverages(schoolId)`

Chaque fonction force `schoolId` depuis la session de l'admin (jamais depuis un
paramètre d'URL) — empêche l'agrégation cross-école.

## Sécurité

- Seul un `SCHOOL_ADMIN` peut lire une vue analytics (guard + `security_invoker` +
  `is_admin_of_school`).
- Un parent ne voit **aucune** statistique d'école (vérifié par
  `scripts/import-security-check.ts`, test A3).

## Tests

- `scripts/import-security-check.ts` : tests A1–A5 (isolation multi-tenant des vues).
