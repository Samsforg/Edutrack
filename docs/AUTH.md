# Authentification & Autorisation

EduTrack s'appuie sur **Supabase Auth** (JWT) et une **RLS PostgreSQL** pour le
multi-tenant. Aucun mot de passe n'est stocké par l'application : il est géré
par Supabase Auth.

## Connexion

- `app/login` — formulaire de connexion par email + mot de passe
  (`signInWithPassword` dans `lib/auth/actions.ts`).
- `app/signup` — création de compte (`signup`). Le profil est étendu
  automatiquement par le trigger `handle_new_user` (migration `0000`).
- `app/auth/callback/route.ts` — rappel OAuth (code exchange), utilisé pour les
  flots de confirmation/adresse.

## Session

- `lib/auth/session.ts` : `getSession()` résout le JWT, renvoie l'utilisateur +
  ses `memberships` (`school_members` → rôles).
- Les pages serveur renvoient vers `/login` si la session est absente ; le
  guard applicatif (`lib/auth/guard.ts`) oriente l'utilisateur vers son espace
  selon son premier rôle (`app/admin`, `app/teacher`, `app/parent`, `app/super-admin`).
- Déconnexion : `app/app/account` (menu → « Se déconnecter », `signOut`).

## Rôles

- `SUPER_ADMIN` — vue plateforme (`app/super-admin`).
- `SCHOOL_ADMIN` — gestion d'établissement (`app/admin`).
- `TEACHER` — appels/notes (`app/teacher`).
- `PARENT` — portail parent (`app/parent`).

Un utilisateur peut cumuler plusieurs rôles/écoles (`school_members`).

## Comptes démo (seed)

| Rôle        | Email                | Mot de passe   |
| ----------- | -------------------- | -------------- |
| Super-admin | `admin@demo.edutrack`| `demo-admin1!` |
| Admin école | `admin@demo.edutrack`| `demo-admin1!` |
| Enseignant  | `teacher1@demo.edutrack` | `demo-teach1!` |
| Parent 1    | `parent1@demo.edutrack` | `demo-parent1!` |
| Parent 2    | `parent2@demo.edutrack` | `demo-parent2!` |
| Parent 3    | `parent3@demo.edutrack` | `demo-parent3!` |

> `admin@demo.edutrack` est à la fois super-admin et admin de l'école démo ;
> chaque rôle vit dans une rangée `school_members` distincte.

## Tests

- `tests/e2e/helpers.ts` centralise les comptes + `loginAs`.
- `tests/e2e/super-admin.spec.ts`, `dashboards.spec.ts`, `school-management.spec.ts`,
  `linking.spec.ts` couvrent la navigation par rôle.