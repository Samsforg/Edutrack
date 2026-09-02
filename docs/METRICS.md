# EduTrack — Métriques SaaS (dashboard super admin)

Le dashboard super admin (`/app/super-admin`) affiche les métriques SaaS
calculées par `lib/db/saas.ts` (`getSaasMetrics`).

## Définitions

| Métrique | Calcul |
|----------|--------|
| **MRR** | Σ (prix annuel / 12) des écoles `active` + `past_due` |
| **ARR** | MRR × 12 |
| **Active Schools** | abonnements `active` |
| **Trial Schools** | abonnements `trialing` |
| **Paid Schools** | abonnements `active` ou `past_due` |
| **Trial Conversion Rate** | active / (trialing + active) × 100 |
| **Churn Rate** | canceled / (active + canceled) × 100 |
| **ARPA** | MRR / paid schools |
| **Students per School** | total élèves / total écoles |

> Notes : les prix annuels sont normalisés en MRR (prix/12) pour l'homogénéité.
> Les statuts `expired` et `past_due` sont suivis séparément (`expiredSchools`,
> `pastDueSchools`).

## Fichier source de vérité du prix

`lib/billing/plans.ts` — ne pas utiliser de prix codés ailleurs.
