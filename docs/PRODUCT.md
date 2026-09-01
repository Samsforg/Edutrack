# Produit & MVP

EduTrack connecte l'école et la famille : un parent suit la scolarité de ses
enfants (présences, notes, annonces) sans appli complexe, et les enseignants
gèrent l'appel en quelques gestes.

## Public cible

- Établissements scolaires (écoles, collèges, lycées privés francophones).
- Enseignants (prise d'appel quotidienne).
- Direction (annonces, gestion élèves/enseignants, import CSV).
- Parents (suivi temps réel, notifications).

## Fonctionnalités (MVP)

### Rôles
- **Parent** : enfants liés, présences live, moyennes, notifications, demandes de liaison.
- **Enseignant** : prise d'appel par classe, saisie de notes.
- **Admin école** (`SCHOOL_ADMIN`) : élèves, enseignants, classes, annonces,
  approbation des demandes de liaison, import CSV, analytique.
- **Super-admin** (`SUPER_ADMIN`) : vue plateforme (toutes les écoles).

### Flux clés
1. **Liaison parent-enfant** par code (sans contact admin pour la saisie).
2. **Prise d'appel** et statuts : présent/absent/retard/excusé.
3. **Notifications Realtime** (absence, annonce) — cloche + page.
4. **Import CSV** des élèves avec prévisualisation et insertion par lot.

## Contraintes technique

- Mobile-first (PWA), léger, hors-ligne favorisé.
- Sécurité multi-tenant stricte (RLS Supabase).

## Hors périmètre (MVP v1)

- Messagerie privée entre enseignants/parents.
- Gestion de la scolarité complète (emploi du temps, paiements).
- Billing / paiement — la facturation est hors périmètre pour le MVP.

## Roadmap indicative

- v1 (MVP) : liaison, présences, notes, annonces, notifications, admin.
- v1.1 : analytique enrichie, export, flux SUPER_ADMIN de création d'école.
- v2 : messagerie, tableaux de bord avancés, multilingue.
