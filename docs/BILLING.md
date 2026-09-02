# EduTrack — Architecture de billing

## Vue d'ensemble

Phase 7 ajoute l'architecture de monétisation sur EduTrack, indépendante du fournisseur de paiement (provider interchangeable). L'architecture fonctionne en mode "manual" par défaut (aucun paiement réel sans provider configuré).

## Tables

- `subscription_plans` — Catalogue des offres (Starter/Standard/Pro) avec prix, limites d'usage, features.
- `school_subscriptions` — Abonnement actuel d'une école (status, dates, provider, cancel_at_period_end).
- `billing_events` — Journal des événements webhook (unicité provider+event_id, idempotence).
- `school_leads` — Demandes de contact/démo commerciales (source, statut lead).
- `billing_audit_logs` — Audit des modifications exceptionnelles des abonnements.

## Lifecycle

1. **Création d'école** → trigger auto `auto_create_trial_subscription()` crée un trial Starter 14 jours.
2. **Onboarding** → 6 étapes (établissement → année → plan → import → équipe → terminé).
3. **Exploitation** → fonctionnalités vérifiées via `writeBlockMessage()`. Si abonnement expiré → lecture seule.
4. **Renouvellement/Upgrade** → `changePlan()` → checkout (provider ou manual).
5. **Webhook** → `/api/billing/webhook` met à jour `school_subscriptions` + log `billing_events` + audit.
6. **Admin override** → super admin peut modifier exceptionnellement le statut/plan.

## Fichiers principaux

| Fichier | Rôle |
|---------|------|
| `lib/billing/plans.ts` | Prix centralisés (source de vérité) |
| `lib/billing/types.ts` | Types partagés (SubscriptionStatus, AccessDecision, etc.) |
| `lib/billing/entitlements.ts` | Vérif accès fonctionnalités + limites usage |
| `lib/billing/access.ts` | `requireActiveSubscription()` + `writeBlockMessage()` |
| `lib/billing/provider.ts` | Abstraction provider (implémentation no-op par défaut) |
| `lib/billing/checkout.ts` | Déclenchement checkout (provider ou manual) |
| `lib/billing/status-labels.ts` | Libellés humains pour les bandeaux |
| `lib/db/billing.ts` | Data access (getSchoolSubscription, getUsage, effectiveStatus) |
| `lib/db/saas.ts` | Métriques SaaS (MRR, ARR, etc.) + leads management |
| `lib/actions/billing.ts` | Server actions (changePlan, cancel, resume) |
| `lib/actions/leads.ts` | Server action submitLead |
| `app/api/billing/webhook/route.ts` | Webhook endpoint |
| `app/school/billing/` | Page + client billing |
| `app/school/onboarding/` | Wizard 6 étapes |
| `app/contact/`, `app/demo/`, `app/pricing/` | Pages commerciales |
| `app/app/super-admin/leads/` | Gestion leads (super admin) |

## Sécurité

- Secrets jamais exposés côté client (server-only).
- `writeBlockMessage()` garde-fou sur toutes les mutations data.
- RLS: subscription admin-only (super admin), leads insert public + read/update super admin, billing_events super admin.
- Audit des modifications d'abonnement via `billing_audit_logs`.
