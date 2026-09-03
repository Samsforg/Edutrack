# Risk Engine — Moteur de risque statistique

## Objectif

Calculer un score de risque 0-100 pour chaque élève, purement statistique, **sans LLM**, explicable et déterministe. Le score agrège 4 facteurs pondérés.

## Formule

```
score = 0.40 × attendance + 0.30 × performance + 0.20 × lateness + 0.10 × recent
```

Chaque facteur ∈ [0, 100]. La sévérité dérive du score final via `severityFor(score, bands)`.

## Facteurs

### 1. Attendance (40 %) — `absenceSubScore(absenceRatePct)`

| Taux absence | Score | Sévérité bande |
|--------------|-------|----------------|
| 0-4 % | 0-25 | low |
| 5-9 % | 26-50 | medium |
| 10-19 % | 51-75 | high |
| ≥ 20 % | 76-100 | critical |

Formule : linéaire par paliers, plafonné à 100.

### 2. Performance (30 %) — `performanceSubScore(avgDrop)`

| Chute moyenne (/20) | Score |
|---------------------|-------|
| 0 | 0 |
| 1.5 | ~50 |
| ≥ 3 | 100 (plafond) |

Seuil déclencheur : `PERFORMANCE_DROP_SIGNAL = 1.5` pts. Récemment : `PERFORMANCE_DROP_RECENT_SIGNAL = 0.8`.

### 3. Lateness (20 %) — `latenessSubScore(lateCount, lateDeltaPct)`

- `lateCount` : nombre retards sur 30j
- `lateDeltaPct` : évolution vs période précédente

Signal fort si `lateDeltaPct ≥ 50%` **et** `lateCount ≥ 5` (`LATE_COUNT_HIGH`).

### 4. Recent (10 %) — `recentSubScore(recentAvgDelta)`

Compare moyenne 10j vs période précédente.
- `recentAvgDelta ≥ 1.2` (IMPROVEMENT_SIGNAL) → score 0 (progression)
- `recentAvgDelta ≤ 0.8` (PERFORMANCE_DROP_RECENT_SIGNAL) → score > 0

## Détection d'insights (`detectStudentRisks`)

| Type | Condition | Sévérité |
|------|-----------|----------|
| `attendance_risk` | absenceRate ≥ 10% ou lateDelta ≥ 50% | medium/high/critical |
| `performance_drop` | chute ≥ 1.5 pts | high/critical |
| `attendance_drop` | absenceRate récent élevé | medium/high |
| `performance_risk` | élève > 1.5 pts sous moyenne classe | medium |
| `positive_trend` | amélioration ≥ 1.2 pts | info |
| `improvement` | progression confirmée | info |

## Déduplication

Clé : `school|student|class|type|windowStart` (date début fenêtre).
TTL déduplication : 24h (`DEDUP_TTL_HOURS`). Évite alertes répétitives.

## Fenêtres d'analyse

| Fenêtre | Jours | Source |
|---------|-------|--------|
| attendance | 30 | `attendance.attendance_date` |
| recent | 10 | `grades.grade_date` |
| lateness | 30 | `attendance` (status=late) |
| grades | 60 | `grades` (published) |

## Anomalies classe (`detectClassAnomaly`)

Déclenchée si :
- Taux présence classe < 85% **OU**
- Moyenne classe < 10/20

Type : `class_anomaly`, sévérité `high`.

## Configuration centrale (`lib/ai/risk/config.ts`)

Tous coefficients, seuils, fenêtres en un seul fichier. Modification = redéploiement, pas de migration DB.

## Tests

- `tests/unit/ai-risk-config.test.ts` — vérifie coefficients/seuils
- `tests/unit/ai-engine.test.ts` — fonctions pures (score, sévérité, recommandations)
- `tests/unit/ai-detect.test.ts` — détection + déduplication

## Explicabilité

Chaque `RiskResult` contient :
- `score` global
- `severity`
- `factors` : { attendance, performance, lateness, recent } ∈ [0,100]
- `reasons` : phrases FR expliquant les signaux
- `recommendations` : actions concrètes (ex "Échanger avec le parent...")

Cela permet à l'admin/teacher de **comprendre** le score sans boîte noire.