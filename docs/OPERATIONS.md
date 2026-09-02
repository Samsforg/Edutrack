# EduTrack — Opérations

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Dev server (Turbopack) sur `http://localhost:3100` |
| `npm run typecheck` | Vérification TypeScript (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm run test` | Tests unitaires Vitest |
| `npm run build` | Build de production |
| `npm run db:seed` | Seed de démo |

## Billing (webhooks) et idempotence

Les événements webhook sont stockés dans `billing_events` avec une contrainte
unique `(provider, event_id)`. Un événement déjà traité est ignoré (aucun
double traitement).

## Journaling / audit

Toute modification exceptionnelle d'un abonnement (override super admin, action
school admin) est journalisée dans `billing_audit_logs` avec `action`,
`old_value`, `new_value`, `user_id`, `school_id`.

## Métriques SaaS

Le dashboard super admin affiche MRR / ARR / active / trial / paid / conversion /
churn / ARPA via `lib/db/saas.ts`.

## Risques & recommandations

- Sans provider configuré, les paiements ne sont pas encaissés en réel : le mode
  est "manual" (le super admin gère les statuts). Activer un provider avant la
  mise en production commerciale.
- Les webhooks doivent être signés (PAYMENT_WEBHOOK_SECRET). Vérifier la signature
  avant toute mise à jour.
- Surveiller les écoles `past_due` : elles passent en suspension après un délai.
