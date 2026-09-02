# Prise de présence (Phase 4)

Documente le flux de présence : appel enseignant, suivi parent, statistiques
administrateur et notifications d'absence/retard.

## Modèle

Chaque élève a **un seul relevé par jour** (`UNIQUE(student_id, attendance_date)`).
Les statuts possibles (`enum public.attendance_status`) :

| Statut | Sens |
| ------ | ---- |
| `present` | présent |
| `absent` | absent |
| `late` | retard (+ heure d'arrivée facultative `check_in`) |
| `excused` | absence excusée |

Colonnes : `school_id`, `student_id`, `classroom_id`, `attendance_date`,
`status`, `check_in`, `check_out`, `note`, `taken_by` (création), `updated_by`
(dernière modification), `created_at`, `updated_at`.

## Règles de sécurité

- **Intégrité inter-écoles** : le trigger `assert_attendance_same_school`
  (migration `0013`) refuse tout relevé dont l'école ou la classe ne
  correspond pas à celles de l'élève. On ne fait **jamais** confiance au
  `school_id` envoyé par le client.
- **RLS `attendance`** :
  - `SELECT` : super-admin, parent de l'élève, ou membre non-parent de l'école.
  - `INSERT/UPDATE/DELETE` (`attendance_write`) : admin de l'école de l'élève
    ou enseignant affecté à la classe. Un parent est **lecture seule**.
  - Aucune politique ne permet de supprimer depuis le rôle parent.
- L'appel échoue silencieusement côté serveur en cas d'accès refusé ;
  l'UI n'affiche jamais de confirmation de sauvegarde sans retour serveur
  valide (`{ ok: true }`).

## Serveur (`lib/actions/attendance.ts`)

`saveAttendance({ classId, date?, entries, checkIns?, checkOuts?, notes? })` :

1. Détermine l'école **côté serveur** depuis la session (jamais le client).
2. Autorise `SCHOOL_ADMIN` ou un `TEACHER` affecté via `class_subjects`.
3. Mappe la classe, extrait les statuts, `ON CONFLICT(student_id,
   attendance_date) DO UPDATE` → **idempotent** (2ᵉ appel met à jour).
4. Crée des **notifications par élève** (Absence / Retard / Absence excusée)
   pour les parents liés, côté serveur (pas le frontend).

Helpers en lecture (`lib/db/attendance-history.ts`) :

- `getStudentsAttendanceHistory(ids, from, to)` — historique paginé.
- `getStudentAttendanceSummary(id, from, to)` — taux + effectifs
  (taux = (présents + excusés) / jours relevés).
- `getTodayStatusesForStudents(ids, date)` — statut du jour pour le tableau
  de bord parent « Aujourd'hui ».
- `hasClassAttendance(classId, date)` — « appel effectué / non effectué ».
- `getSchoolTodayAttendance(schoolId, date)` — points du jour par élève
  (absents + non renseignés) pour le dashboard admin.
- `getTeacherAttendanceHistory(classIds, from, to)` — historique enseignant.

## UI

| Route | Rôle | Contenu |
| ----- | ---- | ------- |
| `/app/teacher/attendance` | Enseignant / Admin | Appel du jour (date, 4 statuts, `check_in` retard, note, « Tout », appel partiel) |
| `/app/teacher/attendance/history` | Enseignant / Admin | Historique par classe + filtre de dates |
| `/app/teacher` | Enseignant | « Mes classes » + statut appel (effectué / à faire) |
| `/app/admin` | Admin | Stats du jour + liste des absents + non renseignés |
| `/app/admin/students/[id]` | Admin | Section « Présence » (taux, effectifs, récent) |
| `/app/parent` | Parent | « Présence aujourd'hui » `AttendanceLive` (temps réel) |
| `/app/parent/children/[id]` | Parent | Taux + effectifs (90 j) |
| `/app/parent/children/[id]/attendance` | Parent | Journal + filtres 7 j / 30 j / année |

### Appel partiel

Avant confirmation, l'UI comptabilise les élèves **non renseignés** et exige une
confirmation explicite « Enregistrer quand même ? ». Aucune sauvegarde partielle
n'est validée par défaut.

### Offline / erreur

En cas d'échec réseau, l'UI n'enregistre ni n'affiche une fausse confirmation :
elle montre « L'appel n'a pas été enregistré » et invite à réessayer. Le
rechargement est possible sans IndexedDB (PWA conservatrice).

## Tests

- **Unitaires** : `tests/unit/attendance.test.ts` (`summarize`).
- **Sécurité RLS (backend réel)** : `scripts/attendance-security-check.ts`
  (14 assertions : lecture parent, croix-parent, croix-école, écriture admin,
  trigger école, notification scopée, suppression interdite…).
  Usage : `npx tsx scripts/attendance-security-check.ts`.
- **Realtime** : `tests/e2e/attendance-live.spec.ts` — le badge parent se met à
  jour en direct (§43) sans rechargement.
- **E2E UI** : `tests/e2e/attendance.spec.ts`, `dashboards.spec.ts`.

## Liens

- [Schéma](./DATABASE.md) · [Sécurité & RLS](./SECURITY.md) · [Realtime](./REALTIME.md)
- [Notifications](./NOTIFICATIONS.md)