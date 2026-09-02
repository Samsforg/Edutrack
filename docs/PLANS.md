# EduTrack — Plans & tarification

## Plans

| Plan | Prix/an | Élèves | Enseignants | Admins |
|------|---------|--------|-------------|--------|
| Starter | 49 000 FCFA | 150 | 15 | 1 |
| **Standard** (populaire) | 99 000 FCFA | 500 | 50 | 3 |
| Pro | 199 000 FCFA | 1 500 | 150 | 10 |

- **Trial gratuit** : 14 jours (Starter), crée automatiquement à la création d'école.
- **Parents** : accès gratuit (portail parents inclus dans tous les plans).
- Les prix sont centralisés dans `lib/billing/plans.ts` et seedés en SQL (migration 0017).

## Features par plan

| Feature | Starter | Standard | Pro |
|---------|---------|----------|-----|
| Présences | ✓ | ✓ | ✓ |
| Notes & moyennes | ✓ | ✓ | ✓ |
| Annonces | ✓ | ✓ | ✓ |
| Notifications parents | ✓ | ✓ | ✓ |
| Portail parents | ✓ | ✓ | ✓ |
| Tableaux de bord | ✓ | ✓ | ✓ |
| Import CSV | ✓ | ✓ | ✓ |
| Rapports de base | ✓ | ✓ | ✓ |
| Analyse avancée | — | ✓ | ✓ |
| Rapports avancés | — | ✓ | ✓ |
| Export CSV | — | ✓ | ✓ |
| Historique étendu | — | ✓ | ✓ |
| Support prioritaire | — | — | ✓ |

## Métriques

- **MRR** = Σ(prix annuel / 12) pour les écoles actives.
- **ARR** = MRR × 12.
- **ARPA** = MRR / écoles payantes.
- **Churn** = canceled / (active + canceled) × 100.
- **Conversion trial** = active / (trialing + active) × 100.

## Règles

- Les prix ne doivent JAMAIS être codés dans les pages. Toutes les lectures passent par `lib/billing/plans.ts` ou la table `subscription_plans`.
- Les limites d'usage sont vérifiées côté serveur avant toute création d'élève/enseignant/admin.
- L'abonnement expiré est en lecture seule : consultation/consultation/export/renouvellement OK, création de données bloquée.
