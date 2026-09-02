# EduTrack — Onboarding en 6 étapes

Le parcours d'onboarding se trouve sur `/school/onboarding`. Il est accessible
au SCHOOL_ADMIN (depuis la checklist de configuration du dashboard).

## Étapes

1. **Établissement** — nom, ville, téléphone, email → `updateSchool`.
2. **Année scolaire** — nom, dates → `createAcademicYear` (première = courante).
3. **Plan** — choix parmi Starter/Standard/Pro → `changePlan`.
4. **Import** — redirection vers `/app/admin/import` (5 types CSV) ou « plus tard ».
5. **Équipe** — gestion des enseignants `/app/admin/teachers` ou « plus tard ».
6. **Terminé** — lien vers le tableau de bord.

Chaque étape **sauvegarde progressivement** : on peut quitter et reprendre.

## Barre de progression

La progression (0-100%) est calculée sur l'étape courante. Une checklist de
configuration (9 items) est également affichée sur le dashboard admin avec
le pourcentage de complétion réel (fiche étab., année, élèves, enseignants,
classes, matières, équipe, présence, plan).

## Règles

- `school_id`, `plan_id`, `user_id`, `subscription_id` sont toujours résolus
  depuis la **session serveur**, jamais depuis le frontend.
- L'essai gratuit de 14 jours démarre automatiquement à la création de l'école.
