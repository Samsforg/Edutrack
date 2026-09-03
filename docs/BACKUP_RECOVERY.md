# Backup & Disaster Recovery — EduTrack

## Stratégie de Backup

### Supabase (PostgreSQL)

| Environnement | Méthode | Fréquence | Rétention | PITR |
|---------------|---------|-----------|-----------|------|
| Production | Supabase Managed + PITR | Continu (WAL) | 30 jours | **Activé** (30j) |
| Staging | Supabase Managed | Quotidien | 7 jours | Non |
| Dev | Supabase Managed | Hebdo | 3 jours | Non |

**PITR (Point-in-Time Recovery)** : Permet de restaurer à n'importe quelle seconde sur 30 jours.
- Activation : Dashboard Supabase → Database → Backups → Enable PITR
- Coût : Inclus dans plan Pro+

### Stockage (Supabase Storage)

| Bucket | Backup | Note |
|--------|--------|------|
| `avatars` | Non (regénérable) | Photos profil |
| `documents` | **Oui** (rsync vers S3) | Documents admin/imports |
| `imports` | Non (temporaire) | CSV imports |

**Script rsync quotidien** (vers S3/Wasabi/MinIO) :
```bash
#!/bin/bash
# backup-storage.sh
aws s3 sync s3://supabase-project-ref/storage/documents s3://edutrack-backups/storage/documents --delete
aws s3 sync s3://supabase-project-ref/storage/imports s3://edutrack-backups/storage/imports --delete
```

### Code & Configuration

| Élément | Méthode | Fréquence |
|---------|---------|-----------|
| Code (Git) | GitHub (mirror) | Continu |
| Migrations SQL | Git (dans repo) | À chaque commit |
| Variables d'env | 1Password / Vercel Secrets | Rotation 90j |
| Secrets Supabase | Dashboard Supabase | Rotation 90j |

---

## Procédure de Restauration

### 1. Restauration Base de Données (PITR)

**Depuis Dashboard Supabase** :
1. Aller dans Database → Backups → Point-in-Time Recovery
2. Choisir timestamp cible (ex: avant incident)
3. Cliquer "Restore" → crée un **nouveau projet** avec les données restaurées
4. Valider les données dans le nouveau projet
5. Switch DNS / connection strings vers le projet restauré

**Via CLI (si configuré)** :
```bash
supabase db restore --project-ref <ref> --timestamp "2025-01-15 14:30:00"
```

### 2. Restauration Stockage

```bash
# Depuis S3 vers Supabase Storage
aws s3 sync s3://edutrack-backups/storage/documents s3://supabase-project-ref/storage/documents
```

### 3. Restauration Code

```bash
# Rollback Vercel (instantané)
vercel rollback <deployment-url>

# Ou git revert + redeploy
git revert <bad-commit>
git push origin main
```

### 4. Validation Post-Restauration

```bash
# 1. Exécuter script d'intégrité
psql -f supabase/scripts/data-integrity-check.sql

# 2. Vérifier migrations appliquées
supabase migration list --project-ref <ref>

# 3. Tests smoke
npm run test:e2e -- --grep "smoke"
```

---

## RPO / RTO

| Scénario | RPO (Perte de données max) | RTO (Temps de restauration) |
|----------|----------------------------|-----------------------------|
| Incident DB mineur (corruption table) | < 1 sec (PITR) | 15-30 min |
| Incident DB majeur (corruption cluster) | < 1 sec (PITR) | 30-60 min |
| Perte stockage (bucket) | 24h (rsync daily) | 1-2h |
| Perte code (Git) | 0 (Git) | 5 min (Vercel rollback) |
| Incident Supabase régional | < 1 sec (PITR) | Dépend Supabase SLA |

---

## Responsabilités

| Rôle | Responsabilité |
|------|----------------|
| **Lead Dev** | Déclencher restauration, valider post-restore |
| **DevOps** | Maintenir scripts backup, tester restore trimestriel |
| **Security** | Valider aucune fuite post-incident |
| **Product** | Communiquer aux clients (status page) |

---

## Test de Restauration (Obligatoire)

**Fréquence** : Trimestriel minimum

**Procédure** :
1. Créer projet Supabase temporaire `edutrack-restore-test`
2. Restaurer via PITR à J-7
3. Exécuter `data-integrity-check.sql` → 0 erreurs
4. Lancer seed démo → `npm run db:seed`
5. Lancer tests E2E critiques → `npm run test:e2e`
6. Documenter durée réelle RTO
7. Nettoyer projet temporaire

**Critère de succès** : RTO < 30 min, 0 erreur intégrité, tests E2E verts.

---

## Checklist Incident Majeur

- [ ] Détecter (alerting Sentry/Supabase/Vercel)
- [ ] Qualifier (impact, données affectées)
- [ ] Contenir (feature flag disable, read-only mode)
- [ ] Décider restauration (PITR vs rollback code)
- [ ] Exécuter restauration
- [ ] Valider intégrité (`data-integrity-check.sql`)
- [ ] Valider fonctionnel (tests smoke)
- [ ] Communiquer (status page, clients impactés)
- [ ] Postmortem (48h max) → doc + actions correctives