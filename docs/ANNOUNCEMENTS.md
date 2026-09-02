# Annonces

Une annonce suit un cycle **brouillon → publiée → (archivée)**. L'admin de
l'école (ou super-admin) est le seul à créer, publier, archiver ou supprimer.
Les parents ne voient que les annonces **publiées** de leur école (toutes ou
celles de la classe de leur enfant).

## Modèle

Table `public.announcements` :

| Colonne | Description |
| ------- | ----------- |
| `school_id` / `author_id` | école + auteur |
| `audience` | `all` (école) ou `class` (classe ciblée) |
| `classroom_id` | classe cible quand `audience = class` |
| `title` / `body` / `important` | contenu + flag « importante » |
| `published_at` | **non nul = publiée** (cycle : `null` = brouillon) |
| `archived_at` | non nul = archivée (masquée aux parents) |

## Parcours admin

- `/app/admin/announcements` : liste avec badges **Brouillon / Publiée /
  Archivée**, boutons Publier, Archiver, Supprimer (définitif) et modification.
- `createAnnouncement` crée un **brouillon** (aucune notification).
- `publishAnnouncement` pose `published_at` puis **notifie tous les parents
  concernés** (école entière ou classe cible) — idempotent (pas de doublon par
  annonce + destinataire).
- `archiveAnnouncement` pose `archived_at` (l'annonce disparaît du portail
  parent, reste dans l'historique admin).
- `deleteAnnouncement` : suppression définitive.

## RLS

- `announcements_select` : super-admin, membre **non parent** de l'école, ou
  parent dont l'enfant est dans la classe cible — **seulement si
  `published_at` non nul et `archived_at` nul**.
- `announcements_admin_write` : admin de l'école ou super-admin (toutes
  opérations).

## Vérification

RLS : `npx tsx scripts/grades-security-check.ts` (N1 : un parent ne lit pas un
brouillon ; N2 : un parent ne crée pas ; N3 : un admin d'une autre école ne crée
pas ; N4 : l'admin lit les brouillons). E2E : page parent + page admin dans
`tests/e2e/phase5-grades.spec.ts`.

## Liens

- [Notes](./GRADES.md) · [Notifications](./NOTIFICATIONS.md) ·
  [Sécurité & RLS](./SECURITY.md)