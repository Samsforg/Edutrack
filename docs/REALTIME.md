# Realtime

EduTrack utilise **Supabase Realtime (Postgres Changes)** pour mettre à jour en
direct l'UI sans polling : présence du jour et cloche de notifications.

## Publication

La migration `0013` ajoute à la publication `supabase_realtime` les tables
publiques nécessaires :

- `public.attendance`
- `public.notifications`

Vérifiable :

```sql
select t.tablename
from pg_publication_tables t
where t.pubname = 'supabase_realtime' and t.schemaname = 'public';
```

Sans ces colonnes de publication, les `postgres_changes` ne délivrent **rien**
(fiabilité vérifiée en dur sur le backend). Le `do block` de la `0013` est
idempotent (n'ajoute une table que si absente).

## Principe de sécurité

Les souscriptions sont **RLS-scopées par abonné** : chaque client abonne un
canal avec un filtre précis (`user_id=eq.<id>` pour les notifications,
`student_id=eq.<id>` pour la présence) et la RLS de rangée bloque toute
livraison hors du périmètre autorisé du lecteur. **Aucun Realtime public** et
aucun canal non filtré.

## Authentification avant abonnement (important)

Si un canal s'abonne **avant** que le token de session ne soit attaché au
client Supabase, le WebSocket se connecte anonymement : les événements
RLS-scopés ne sont jamais délivrés (le canal passe par `CLOSED` puis
`SUBSCRIBED`, mais rien n'arrive).

Tous nos composants de souscription attendent donc la session avant d'ouvrir
le canal :

```ts
await supabase.auth.getSession().then(({ data }) => {
  if (!data.session) return;
  const ch = supabase.channel("…");
  ch.on("postgres_changes", { event: "*", schema: "public", table: "attendance",
        filter: `student_id=eq.${studentId}` }, handler).subscribe();
});
```

## Composants

- `components/live/attendance-live.tsx` — badge « Aujourd'hui » du parent :
  premier SELECT du statut actuel, puis mise à jour sur INSERT/UPDATE du relevé
  du jour.
- `components/live/notification-bell.tsx` — cloche avec compteur non-lu,
  alimentée au fil de l'eau sur la table `notifications`.

Chaque composant ouvre **une seule souscription** et la ferme au démontage
(`supabase.removeChannel`) — pas de fuite de connexions.

## Un seul canal par page

Le tableau de bord parent monte un `AttendanceLive` **par enfant** (un canal
par enfant) plus la cloche ; c'est volontaire et borné : le nombre d'enfants
d'un parent reste faible. On évite tout abonnement agrégé « toute l'école ».

## Tests

- `tests/e2e/attendance-live.spec.ts` (Realtime §43) : injecte une écriture via
  le service role et vérifie que le badge parent bascule en direct, **sans
  rechargement de page**.
- Les isolations RLS des événements sont couvertes par
  `scripts/attendance-security-check.ts`.

## Liens

- [Schéma](./DATABASE.md) · [Sécurité & RLS](./SECURITY.md) · [Présence](./ATTENDANCE.md)