# Liaison parent-élève par code

Le flux sécurisé qui permet à un parent de suivre la scolarité de son enfant,
sans exposer d'identifiant scolaire.

## Principe

L'école (admin) génère un code de liaison. Le parent le saisit dans le portail
parent ; l'école approuve ; le parent voit alors l'enfant. Le code **n'est
jamais stocké en clair** et n'est **jamais révélé après sa génération**.

## Garanties de sécurité

- **Hash salé** : `code_hash = sha256(code_salt || code_normalisé)` (migration
  `0011`), égalité indexable. `students.link_code` supprimé (`0012`).
- **Entropie** : format `EDU-XXXX-XXXX`, alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`
  (32 caractères, aucun biais de modulo).
- **Cycle de vie** : expiration `expires_at` (7 jours), usage unique `used_at`,
  révocation `revoked_at` (index unique partiel `uq_link_codes_active_student` :
  un seul code actif par élève).
- **Rate limiting** : `link_code_attempts` + RPC `attempt_slowdown()` (~10
  essais / 5 min).
- **Confidentialité** : `verify_link_code` ne renvoie que prénom/nom/école —
  jamais `matricule` ni `classroom_id`.

## Rôles & droits (RLS)

| Rôle        | `student_link_codes` | `student_link_requests`                     |
| ----------- | -------------------- | ------------------------------------------- |
| Admin école | générer/lister/révoquer | approuver / rejeter / lire (même école)   |
| Super-admin | tout                  | administration                              |
| Parent      | **interdit**          | créer + voir **ses propres** demandes ; annuler une sienne `pending` ; **jamais** approuver |
| Autre école | interdit              | invisible / intouchable                     |

## Flux utilisateur

### 1. Génération (admin)

`/app/admin/students/[id]` → carte « Code de liaison parent » → « Générer un
code ». Le code s'affiche **une seule fois** (avec date d'expiration) ; il doit
être transmis au parent par un canal hors plateforme (papier, OSMS, …).

Action : `generateStudentLinkCode(studentId, schoolId)`.

### 2. Vérification + demande (parent)

`/app/parent/link` → deux étapes :

1. **Vérifier le code** → `verifyStudentLinkCode(code)` (RPC `verify_link_code`) :
   affiche l'enfant + l'école correspondants **avant** tout engagement.
2. **Confirmer la liaison** → `createLinkRequest(code)` (RPC
   `create_link_request`) : consomme le code atomiquement et crée la demande
   `pending`.

L'utilisateur est automatiquement enregistré comme `PARENT` de l'école du code.

### 3. Approbation (admin)

`/app/admin/link-requests` → onglets (Toutes / En attente / Approuvées /
Rejetées / Expirées) → « Approuver » ou « Rejeter » (avec motif). L'approbation
crée la liaison `student_parents` (et rattache le rôle `PARENT`).

Action : `approveLinkRequest` / `rejectLinkRequest` (RPC `resolve_link_request`).

### 4. Suivi (parent)

Le parent voit « Mes enfants » (dashboard + `/app/parent/children`) et le détail
protégé par RLS (`/app/parent/children/[id]`).

## Messages d'erreur (server actions)

`RATE_LIMITED`, `CODE_NOT_FOUND`, `PENDING_EXISTS`, `NOT_FOUND`, `NOT_PENDING`,
`EXPIRED`, `NOT_ALLOWED` → mappés en français dans les toasts/champs.

## Tests

- **Unitaires** : `tests/unit/link-codes.test.ts` (format / normalisation /
  hash / sel) — partie de `npm run test`.
- **Sécurité RLS (backend réel)** : `scripts/parent-linking-security-check.ts`
  — 13 scénarios (génération, hash-only, isolations inter-écoles, usage unique,
  approbation réservée au staff, …). Usage : `npx tsx scripts/parent-linking-security-check.ts`.
- **E2E UI** : `tests/e2e/linking.spec.ts` + `dashboards.spec.ts`.

## Implémentation clé

- `lib/link-codes.ts` — `generateLinkCode`, `normalizeLinkCode`, `isValidLinkCode`,
  `generateCodeSalt`, `hashLinkCode`, `LINK_CODE_REGEX`.
- `lib/actions/linking.ts` — server actions (Zod).
- `lib/db/parent.ts`, `lib/db/parent-link-requests.ts`, `lib/db/students.ts`,
  `lib/db/link-requests.ts` — requêtes RLS.
- Migrations : `20250401000011_secure_parent_linking.sql`,
  `20250401000012_drop_students_link_code.sql`.