# EduTrack — Mise en production & billing provider

## Env vars

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # Server-only (webhook, jobs, admin)
NEXT_PUBLIC_APP_URL=

# Billing provider (optionnel — sans lui, le billing est en mode "manual")
PAYMENT_PROVIDER=                    # ex: stripe | paystack | flutterwave
PAYMENT_SECRET_KEY=
PAYMENT_WEBHOOK_SECRET=
```

> **Ne jamais committer les valeurs réelles** des clés dans le repo. `NEXT_PUBLIC_*`
> sont exposées au navigateur ; les `PAYMENT_*` et `SUPABASE_SERVICE_ROLE_KEY`
> doivent rester server-only.

## Connexion d'un provider de paiement

1. Implémenter l'interface `PaymentProvider` dans `lib/billing/provider.ts`
   (créer un sous-module par provider).
2. Brancher le provider dans `getPaymentProvider()` selon `PAYMENT_PROVIDER`.
3. Configurer le webhook du provider vers `/api/billing/webhook` (POST, JSON), en
   signant les requêtes avec `PAYMENT_WEBHOOK_SECRET` (header `x-webhook-id` = signature HMAC-SHA256).
4. Vérifier que les événements traités couvrent : checkout.completed, invoice.paid,
   invoice.payment_failed, customer.subscription.created/updated/deleted, trial.expired.

Sans provider configuré, le billing reste **manuel** : le super admin gère les
statuts, et les leads/contacts servent de file d'attente commerciale. Aucun
paiement "maison" n'est créé.

## Actions manuelles super admin

- Modifier le statut / plan d'une école : `overrideSubscription` (journalisée dans `billing_audit_logs`).
- Suivre les leads (contact/démo) et changer leur statut.

## Prêt pilote

- Vérifier que tous les rôles (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, PARENT) ont
  bien accès à leurs sections.
- Vérifier que la création d'une nouvelle école crée bien le trial 14 jours.
- Vérifier qu'un abonnement `expired` passe en lecture seule (les mutations sont bloquées).
