# Import de données (CSV) — Phase 6

EduTrack permet d'importer en masse les données de rentrée : **élèves**, **parents**,
**enseignants**, **classes** et **matières** via des fichiers CSV, avec prévisualisation,
validation et journalisation.

## Route d'accès

- UI admin : `/app/admin/import` (accessible au `SCHOOL_ADMIN` uniquement).
- Actions serveur : `lib/actions/import.ts`.
- Parsing/validation : `lib/import/parse.ts`.

## Types d'import pris en charge

| Type      | Colonnes (canoniques)                                              | Clé d'unicité |
|-----------|---------------------------------------------------------------------|---------------|
| students  | `matricule`, `first_name`, `last_name`, `date_of_birth`, `gender`, `class_name` | matricule |
| parents   | `first_name`, `last_name`, `email`, `phone`                        | email / nom+prénom |
| teachers  | `employee_number`, `first_name`, `last_name`, `email`, `phone`     | employee_number |
| classes   | `name`, `level`, `academic_year_name`                              | name |
| subjects  | `code`, `name`                                                     | code |

Des **alias** sont acceptés pour les en-têtes (ex. `prénom`, `prenom`, `nom`,
`classe`, `sexe`, `niveau`…), normalisés sans accents ni espace. Un modèle prêt à
l'emploi est téléchargeable depuis le wizard (`Télécharger le modèle`).

## Workflow (10 étapes)

1. L'admin ouvre `/app/admin/import`.
2. Choisit le **type** d'entité (élèves/parents/enseignants/classes/matières).
3. Télécharge le **modèle CSV** (en-têtes + exemple).
4. **Upload** le fichier .csv (lecture locale, découpage via le parseur CSV).
5. **Prévisualisation** : le serveur valide chaque ligne (Zod) et détecte les
   doublons (dans le fichier + en base).
6. L'admin **vérifie** les colonnes, les erreurs et les doublons signalés.
7. Confirme l'import : envoi des lignes valides, par **lots de 200**.
8. Le serveur résout les clés étrangères (classes → ids, année scolaire courante).
9. Création facultative de **comptes** enseignant/parent (mot de passe aléatoire).
10. **Journal** : une ligne `import_jobs` est créée (total / succès / erreurs).

## Sécurité & contraintes

- **`bulkInsert` serveur** : tous les insertions se font côté serveur avec la clé
  service role (l'API anon ne fait que la prévisualisation/lecture).
- **`school_id` forcé côté serveur** : la valeur provient de la session admin,
  jamais du fichier — empêche toute insertion cross-école.
- **Zod** valide les types, les emails, les téléphones et les dates `AAAA-MM-JJ`.
- **Doublons** détectés en mémoire + requête en base (matricule / employee_number).
- **Lot** : `BATCH = 200` lignes ; les lignes en double sont signalées, pas plantées.
- **Journal** : `import_jobs` (RLS `is_admin_of_school`) — seule une personne
  `SCHOOL_ADMIN` de l'école concernée peut lire/écrire l'historique.
- **Pas de réutilisation de mot de passe faible** : mot de passe aléatoire sécurisé
  (`cryptoRandomPassword`).

## Journal `import_jobs`

Colonnes : `school_id`, `user_id`, `type`, `status`, `total_rows`,
`success_rows`, `error_rows`, `file_name`, `errors` (JSON), `created_at`,
`completed_at`.

Politiques RLS (migration `0015`) :
- `SELECT` : `is_admin_of_school(school_id)`.
- `INSERT` : `is_admin_of_school(school_id)`.
- `UPDATE` : `is_admin_of_school(school_id)`.

## Tests

- `tests/unit/import.test.ts` : parseur CSV, validation, doublons, templates,
  neutralisation d'injection CSV.
- `scripts/import-security-check.ts` : isolement multi-tenant (13 vérifs, vertes).
