# Audit de Sécurité — Phase 6

Audit d'isolation multi-tenant et de durcissement des imports, analytics et
rapports. Complète `docs/SECURITY.md`.

## Modèle de confiance (rappel)

EduTrack est un SaaS multi-tenant :
- un utilisateur ne peut **jamais** lire/écrire les données d'une autre école ;
- un parent ne voit que les données de ses propres enfants ;
- les fonctions de statistiques/import ne sont accessibles qu'au `SCHOOL_ADMIN`.

## Mécanismes de Phase 6

### Import (`import_jobs`)
- RLS `SELECT`/`INSERT`/`UPDATE` via `is_admin_of_school(school_id)` (0015).
- `school_id` **forcé côté serveur** depuis la session, jamais depuis le fichier.
- Insertion via la clé service role (côté serveur) ; l'API anon ne lit pas les tables
  de staging.

### Analytics (vues)
- Vues `SECURITY INVOKER` (respectent les RLS sous-jacentes).
- **Guard admin** sur chaque vue : `where is_admin_of_school(school_id)` (fonction
  `security definer`). Un parent ou un admin externe ne lit aucune statistique.

### Rapports / exports
- `schoolId` depuis la session, `.eq("school_id", ...)` + RLS, `LIMIT` bornée.
- **Anti-CSV-injection** : cellules `= + - @` / tabulation / retour-ligne préfixées
  d'une apostrophe (voir `docs/REPORTS.md`).

### Fonctions `security definer` utilisées
`is_admin_of_school` (helpers `0016`/`0002`) — `set search_path = public`,
schema-qualifiant via `public.*`. Utile en lecture/validation sans récursion RLS.

## Scripts de vérification (RLS réelle via API anon)

| Script | Couverture | Résultat |
|--------|-----------|----------|
| `scripts/attendance-security-check.ts` | présences / annonces | 14/14 |
| `scripts/grades-security-check.ts` | notes / évaluations / périodes | 16/16 |
| `scripts/parent-linking-security-check.ts` | liaison parent-enfant | 13/13 |
| `scripts/import-security-check.ts` | imports / analytics / rapports | 13/13 |

**Total : 56 vérifications vertes** après re-exécution complète.

Cas couverts par `import-security-check.ts` :
- admin écrit/lit son propre historique d'import (RLS insert + select) ;
- admin **d'une autre école** ne lit ni n'écrit d'import cross-école ;
- un **parent** ne peut pas créer d'import ni lire les KPIs ;
- admin externe ne lit pas les vues KPIs / notes / assiduité ;
- admin externe / enseignant externe ne lit pas les données sources des rapports.

## États des risques

- **Risque** : une vue `security_invoker` hérite des RLS ; si une future table ajoutée
  à la vue a une RLS trop permissive, l'admin guard reste une ceinture de sécurité
  (échec par défaut côté non-admin).
- **Recommandé** : ne **jamais** retirer `is_admin_of_school(...)` des vues analytics.
- Les mots de passe de comptes créés par import sont **aléatoires** et ne sont jamais
  journalisés (ni committés).
