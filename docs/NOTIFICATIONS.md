# Notifications

EduTrack notifie les parents en temps réel lors d'événements de la scolarité :
absence, retard, absence excusée (Phase 4), **publication de notes** et
**annonces publiées** (Phase 5).

## Modèle

Table `public.notifications` :

| Colonne | Description |
| ------- | ----------- |
| `user_id` | destinataire (un `auth.users`) |
| `type` | `attendance`, `grade`, `announcement`, `system` (`enum notification_type`) |
| `title` / `body` | message métier |
| `link` | page cible (ex. `/app/parent`) |
| `read_at` | non nul si lue |
| `created_at` | horodatage |

## Règles RLS

- **`notifications_own`** (for all) : `user_id = auth.uid()` (ou super-admin).
  Un utilisateur ne voit/modifie/supprime **que ses propres** notifications.
- **`notifications_staff_insert`** (insert) : le staff d'une école ne peut
  notifier que ses propres parents (`staff_can_notify_parent(user_id)`).
  Un staff d'une autre école ne peut pas spammer un parent étranger.

Une notification est créée **uniquement côté serveur** (jamais depuis le
frontend) : les server actions `lib/actions/attendance.ts`, `academic.ts` et
`announcements.ts` insèrent les lignes.

## Génération côté serveur

À la prise d'appel (`saveAttendance`), pour chaque statut non-`present`, une
notification **par élève** est générée pour **tous les parents liés** :

| Statut | Titre | Corps |
| ------ | ----- | ----- |
| `absent` | Absence | « Votre enfant {prénom nom} est marqué absent aujourd'hui. » |
| `late` | Retard | « … en retard aujourd'hui. » |
| `excused` | Absence excusée | « … excusé aujourd'hui. » |

Le `link` pointe vers `/app/parent` (dashboard « Aujourd'hui »).

## Notes publiées (Phase 5)

À la publication d'une évaluation (`publishGrades` dans
`lib/actions/academic.ts`), pour chaque élève dont une note vient d'être
publiée et pour chaque parent lié :

| Champ | Valeur |
| ----- | ------ |
| `type` | `grade` |
| `title` | « Nouvelle note » |
| `body` | « Une nouvelle note de {matière} ({titre de l'évaluation}) a été publiée. » |
| `link` | `/app/parent` |

Idempotent : aucune notification redondante si une publication identique
existe déjà (contrôle par type + corps contenant le titre de l'évaluation).

## Annonces publiées (Phase 5)

À la publication d'une annonce (`publishAnnouncement` dans
`lib/actions/announcements.ts`) :

- destinataires : tous les parents de l'école (`audience = all`) ou les parents
  des enfants de la classe cible (`audience = class`) ;
- `type` : `announcement`, `link` : `/app/parent/announcements`, `title` : le
  titre de l'annonce, `body` : « Annonce importante de votre établissement. »
  si `important` ;
- idempotent (filtre des destinataires déjà notifiés pour cette annonce).

Les annonces **brouillon** ne déclenchent aucune notification.

## UI

- **Cloche** (`components/live/notification-bell.tsx`) : compteur de non-lues
  dans l'entête, mise à jour en direct via Realtime
  (`postgres_changes` sur `notifications`, filtre `user_id=eq.<id>`).
- **Page parent** (`/app/parent/notifications`) : liste chronologique,
  marquage d'une seule (clic) ou **« Tout marquer comme lu »**
  (`lib/actions/notifications.ts` → `markAllNotificationsRead`).
- **Nav parent** : entrée « Notifications » dans `app/app/app-shell.tsx`.

## Bonnes pratiques appliquées

- Pas de doublon `user_id` adverse : chaque ligne est dédiée à un destinataire.
- Pas de notification inventée : on ne notifie que les statuts prévus, et
  seulement aux parents concernés.
- Marquage « lu » via RLS `notifications_own` ; un tiers ne peut pas dériver le
  contenu d'une autre.

## Tests

- **RLS** : `scripts/attendance-security-check.ts`
  (R9b/R9c : scopage, R10 : mise à jour d'une notification d'un tiers bloquée,
  R11 : staff étranger ne peut pas notifier un parent DEMO).
- **E2E** : `tests/e2e/attendance.spec.ts` (page notifications) et
  `tests/e2e/phase5-grades.spec.ts` (publication notes/annonces).

## Liens

- [Schéma](./DATABASE.md) · [Sécurité & RLS](./SECURITY.md) · [Realtime](./REALTIME.md)
- [Notes](./GRADES.md) · [Annonces](./ANNOUNCEMENTS.md)