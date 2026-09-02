# Préparation du Pilote — Phase 6

Ce document décrit comment **déployer, configurer et vérifier** EduTrack avant de
l'ouvrir à un petit établissement pilote, en s'appuyant sur les imports, les
analytics, les rapports et la sécurité de la Phase 6.

> Voir aussi `docs/DEPLOYMENT.md` (déploiement général) et `docs/IMPORTS.md`.

## 1) Prérequis techniques

- Migrations appliquées sur l'environnement cible : de `0015` (imports/index)
  à `0016` (vues analytics).
- `.env.local` / variables d'environnement : `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Build de production : `npm run build` puis `npm start` (ou hébergement Vercel).

## 2) Préparer les données

1. **Créer l'établissement** dans l'admin (école + admin `SCHOOL_ADMIN`).
2. **Charger une année scolaire courante** (sinon les imports de classes
   échoueront faute d'année).
3. **Créer les classes et matières** — soit manuellement, soit par `Import`
   (`/app/admin/import`, types `classes` et `subjects`).
4. **Importer les parents** puis **les élèves** (l'import élèves exige que leurs
   classes existent déjà).
5. **Importer les enseignants** et les assigner à leurs matières/classes.

Recommandé : utiliser les **modèles CSV** téléchargeables depuis le wizard, puis
prévisualiser avant de confirmer.

## 3) Vérifier l'isolation (avant lancement)

Exécuter les scripts de sécurité contre l'environnement pilote :
```
npx tsx scripts/attendance-security-check.ts
npx tsx scripts/grades-security-check.ts
npx tsx scripts/parent-linking-security-check.ts
npx tsx scripts/import-security-check.ts
```
Toutes les vérifications doivent être **vertes** (56 au total).

## 4) Vérifier l'analytique & les rapports

- Se connecter en admin → `Analyse` : les KPI doivent refléter les effectifs,
  l'assiduité et les moyennes.
- `Rapports` : générer un export CSV de chaque type ; vérifier qu'il s'ouvre sans
  être interprété comme une formule (anti-injection CSV).

## 5) Monitoring & gestion d'erreurs

- **Server Actions** : chaque action retourne `{ ok }` / `{ error }` ; l'UI affiche
  un message d'erreur clair (bannière `sonner`).
- **Journal d'import** : `import_jobs` conserve trace de chaque import (succès /
  erreurs) — exploitable pour le support.
- **Recommandé** : activer la surveillance des erreurs de runtime (ex. Sentry) et
  les logs de la console Supabase pour les fonctions `security definer`.

## 6) Mode hors-ligne léger

Le pilote peut rencontrer des interruptions réseau : l'UI gère les états de
chargement et d'erreur (pas de corruption d'état). Les imports **prévisualisent**
localement (côté client) et n'envoient que si la connexion le permet ; en cas
d'échec réseau, un message invite à réessayer (aucune donnée partielle n'est
committée).

## 7) Checklist de mise en service

- [ ] Migrations `0015` + `0016` appliquées.
- [ ] École + admin créés, année scolaire courante définie.
- [ ] Classes & matières présentes (via import ou manuel).
- [ ] Parents & élèves importés ; enseignants assignés.
- [ ] 4 scripts de sécurité **verts** (56 checks).
- [ ] Dashboard `Analyse` affiche les KPI attendus.
- [ ] Export CSV `Rapports` fonctionne (échantillon vérifié sans formule).
- [ ] Backups/restauration testés (voir `docs/DEPLOYMENT.md`).
- [ ] Monitoring d'erreurs activé (recommandé).

## 8) Dimensionnement du pilote

Le seed démo (`supabase/seed.ts`) et la brique import sont calibrés pour un pilote
de **20 à 50 élèves**. Au-delà, la pagination (élèves), les index (`0015`) et les
vues SQL analytics (`0016`) tiennent la charge ; les imports sont batchés par 200.
