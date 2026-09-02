# Rapports & Export CSV — Phase 6

Génération de rapports et d'exports **CSV côté serveur**, filtrés par
établissement, pour le `SCHOOL_ADMIN` (`/app/admin/reports`).

## Rapports disponibles

- **Assiduité (30 jours)** : taux de présence, absences, retards, absences
  justifiées, tendance quotidienne.
- **Académique** : moyennes `/100` par matière et par classe.
- **Assiduité par classe** : taux de présence par classe sur 30 jours.

## Exports CSV

Boutons dans la barre d'export du rapport :

| Export | Contenu |
|--------|---------|
| Élèves | matricule, nom, prénom, genre, date de naissance, statut, classe |
| Assiduité | élève, classe, date, statut |
| Notes | élève, matière, classe, score, barème, date de publication |
| Statistiques | KPI agrégés (effectifs) |

## Génération côté serveur

`lib/actions/reports.ts` expose la Server Action `generateReport(schoolId, type, opts)` :

- **Server-only** : `cookies()` + `lib/supabase/server` utilisés côté serveur
  uniquement (pas d'exposition au bundle client).
- **`schoolId` depuis la session** : jamais depuis le client — un expert
  technique ne peut pas provoquer un export d'une autre école.
- **Scoping** : chaque requête `.eq("school_id", schoolId)` (RLS en prime).
- **Limite** : `LIMIT = 10_000` lignes pour borner la taille des exports.

## Anti-injection CSV

`lib/csv.ts` (`sanitizeCsvCell` / `csvRow`) protège contre la **CSV formula
injection** : toute cellule commençant par `=`, `+`, `-`, `@` (ou contenant une
tabulation / retour-ligne) est préfixée d'une apostrophe `'`, les guillemets sont
doublés. Un export mystérieux `=SUM(A1)` ne s'évalue pas comme formule dans un
tableur.

Couvert par `tests/unit/import.test.ts` (suite « CSV formula injection protection »).

## Sécurité

- Rôle requis : `SCHOOL_ADMIN` (`requireRole` côté page, `requireAdmin` côté action).
- Filtrage et scoping **serveur**. Les cellules sont échappées.
- Vérifié cross-école par `scripts/import-security-check.ts` (tests R1–R2).
