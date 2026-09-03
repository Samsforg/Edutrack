# Privacy Data Map — EduTrack

## Principe : Minimisation & Purpose Limitation

Chaque donnée collectée a une **finalité explicite**, une **base légale**, une **durée de conservation** et un **droit d'accès/suppression**.

---

## Mapping Données → Finalité → Conservation → Suppression

| Table / Donnée | Finalité | Base Légale | Conservation | Suppression Auto | Droit d'accès | Droit suppression |
|----------------|----------|-------------|--------------|------------------|---------------|-------------------|
| **profiles** (id, email, full_name, avatar) | Authentification, identification | Contrat (CGU) | Durée compte + 2 ans | Anonymisation 2 ans post-suppression | ✅ Portabilité | ✅ (anonymisation) |
| **schools** (nom, code, adresse, téléphone, email) | Gestion établissement | Intérêt légitime / Contrat | Durée école + 5 ans | Archivage 5 ans | ✅ (admin école) | ✅ (super-admin) |
| **school_members** (user_id, school_id, role) | RBAC, multi-tenant | Contrat | Durée membership + 2 ans | Suppression cascade | ✅ (utilisateur) | ✅ (retrait école) |
| **students** (matricule, nom, prénom, naissance, sexe, classe, année) | Scolarité, suivi pédagogique | Intérêt légitime (éducation) | Durée scolarité + 5 ans | Archivage 5 ans post-départ | ✅ (parent, admin) | ✅ (sortie élève) |
| **parents** (user_id, nom, prénom) | Liaison parent-enfant, notifications | Consentement / Intérêt légitime | Durée liaison + 2 ans | Suppression cascade | ✅ (parent) | ✅ (retrait liaison) |
| **student_parents** (student_id, parent_id) | Liaison, droits d'accès | Consentement | Durée liaison | Suppression manuelle | ✅ | ✅ |
| **teachers** (employee_number, nom, prénom, user_id) | Gestion enseignants | Contrat | Durée emploi + 5 ans | Archivage | ✅ (admin) | ✅ (départ) |
| **classes** (nom, niveau, année, école) | Organisation pédagogique | Intérêt légitime | Durée année + 3 ans | Archivage | ✅ (admin) | N/A |
| **subjects** (nom, code, école) | Référentiel matières | Intérêt légitime | Durée école | N/A | ✅ | N/A |
| **academic_years** (nom, dates, école) | Cadre temporel | Intérêt légitime | Durée + 3 ans | Archivage | ✅ | N/A |
| **academic_periods** (trimestres, dates) | Découpage évaluation | Intérêt légitime | Durée année | Archivage | ✅ | N/A |
| **assessments** (titre, date, max_score, coeff, publiée) | Évaluation élèves | Intérêt légitime | Durée année + 3 ans | Archivage | ✅ (parent, prof) | N/A |
| **grades** (score, max, coeff, date, publiée, commentaire) | Bulletin, suivi | Intérêt légitime | Durée scolarité + 5 ans | Archivage | ✅ (parent, élève) | ✅ (correction) |
| **attendance** (date, statut, check_in/out, note) | Suivi assiduité | Obligation légale (éducation) | Durée scolarité + 3 ans | Archivage | ✅ (parent, admin) | N/A (obligation légale) |
| **announcements** (titre, corps, audience, importante) | Communication école | Intérêt légitime | 2 ans | Suppression auto 2 ans | ✅ | ✅ (admin) |
| **notifications** (type, titre, corps, lien, lu, priorité) | Information temps réel | Intérêt légitime | 2 ans | Suppression auto 2 ans | ✅ | ✅ (utilisateur) |
| **student_link_requests** (code, statut, parent/enfant) | Liaison parent-enfant | Consentement | 30 jours (pending) / 2 ans | Auto-expiration 30j | ✅ | ✅ (retrait) |
| **subscription_plans** (nom, prix, features) | Référentiel tarifs | Intérêt légitime | Durée plan | N/A | ✅ | N/A |
| **school_subscriptions** (plan, statut, dates, provider) | Facturation, accès | Contrat | Durée abonnement + 7 ans | Comptabilité 7 ans | ✅ (admin) | N/A (comptabilité) |
| **billing_events** (type, amount, currency, provider_ref) | Audit facturation | Obligation légale (comptable) | 10 ans | Archivage légal | ✅ (admin) | N/A (légal) |
| **school_leads** (nom, email, téléphone, statut) | Prospection commerciale | Consentement / Intérêt légitime | 3 ans post-dernier contact | Suppression auto 3 ans | ✅ | ✅ (RGPD) |

---

## Données IA (Phase 8)

| Table / Donnée | Finalité | Base Légale | Conservation | Suppression Auto |
|----------------|----------|-------------|--------------|------------------|
| **ai_insights** (type, sévérité, titre, résumé, evidence, recommandation) | Alertes pédagogiques | Intérêt légitime (éducation) | 7 jours (TTL) + 24h déduplication | Auto-expiration `expires_at` |
| **ai_audit_logs** (action, model, input/output type, latency, tokens) | Audit, conformité, coûts | Intérêt légitime / Obligation | 2 ans | Auto-suppression 2 ans |
| **ai_usage** (requests_day/month, summaries, insights, tokens) | Quotas, facturation, monitoring | Contrat / Intérêt légitime | 13 mois (rolling) | Rolling window |
| **communication_preferences** (sms, whatsapp, email, push) | Consentement canaux | Consentement explicite | Durée compte | Suppression cascade |
| **feature_flags** (key, rollout, school_id) | Rollout progressif | Intérêt légitime | Durée flag | N/A |
| **knowledge_documents** (titre, contenu, catégorie, embedding) | RAG, assistance | Intérêt légitime | Durée doc | Suppression manuelle |
| **ai_job_queue** (job_type, payload, status, attempts) | Automatisation | Intérêt légitime | 30 jours | Auto-nettoyage `cleanup-expired-insights` |

---

## Données Sensibles / Spéciales

| Donnée | Catégorie | Protection Renforcée |
|--------|-----------|---------------------|
| `profiles.email` | Identifiant direct | Hashé dans logs, jamais en clair dans erreurs |
| `students.birth_date` | Donnée mineur | Chiffrée au repos (Supabase), accès RLS strict |
| `students.gender` | Donnée sensible | Accès RLS (parent/admin seulement) |
| `attendance.check_in/out` | Géolocalisation potentielle | Pas stocké (optionnel, pas implémenté) |
| `billing_events.provider_customer_id` | PII financier | Jamais loggué, rotation clés 90j |
| `ai_insights.evidence` (JSON) | Données agrégées | Pas de PII brute, uniquement stats |

---

## Droits Utilisateurs (RGPD)

| Droit | Implémentation |
|-------|----------------|
| **Accès** | `/app/account` + export JSON via server action `exportUserData` |
| **Rectification** | `/app/account` (nom, email), `/app/admin/students/[id]` (admin) |
| **Effacement** | Server action `deleteAccount` → anonymisation (pas suppression dure pour intégrité référentielle) |
| **Portabilité** | Export JSON complet (profil, enfants, notes, présences, insights) |
| **Limitation** | Feature flag `account_suspended` → read-only |
| **Opposition** | Communication prefs (désactiver email/push/SMS/WhatsApp) |
| **Automatisation** | Pas de décision automatisée à effet juridique (IA = assistance seulement) |

---

## Transferts Internationaux

| Destinataire | Pays | Mécanisme | Finalité |
|--------------|------|-----------|----------|
| **Supabase** (PostgreSQL, Auth, Storage) | UE (Frankfurt) | Pas de transfert (hébergement UE) | Hébergement DB/Auth |
| **Vercel** (Edge, Functions) | UE (Frankfurt) | Pas de transfert | Hosting, Edge Functions |
| **Sentry** (si activé) | UE / US | SCC + Addendum | Error tracking |
| **Fournisseur Email** (Resend/SendGrid) | UE / US | SCC | Emails transactionnels |
| **Fournisseur SMS** (Twilio/MessageBird) | UE / US | SCC | SMS notifications |
| **Fournisseur AI** (OpenAI/Anthropic) | US | SCC + DPA | AI Gateway (optionnel) |

**Règle** : Privilégier fournisseurs UE. Si US → SCC + DPA + analyse d'impact.

---

## Sécurité Technique

| Mesure | Implémentation |
|--------|----------------|
| Chiffrement au repos | Supabase (AES-256), Vercel (AES-256) |
| Chiffrement en transit | TLS 1.2+ partout (HTTPS, WSS) |
| Clés gérées | Supabase managed keys (option CMEK dispo) |
| Rotation secrets | 90j (Vercel Secrets, Supabase Dashboard) |
| Accès DB | RLS + helpers `security definer` + least privilege |
| Logs | Sanitization (password, token, secret, PII) |
| Audit trail | `ai_audit_logs`, `billing_events`, `school_members` history |

---

## Rétention Détaillée par Type

| Type | Durée | Action Fin |
|------|-------|------------|
| Logs applicatifs (Vercel/Sentry) | 30 jours | Auto-purge |
| Logs audit (`ai_audit_logs`, `billing_events`) | 2 ans / 10 ans | Auto-purge / Archivage légal |
| Notifications in-app | 2 ans | Auto-purge |
| Sessions utilisateur | 30 jours (refresh token) | Expiration auto |
| Codes liaison parent | 30 jours | Auto-expiration |
| Jobs queue (`ai_job_queue`) | 30 jours | Auto-nettoyage |
| Fichiers upload (avatars, docs) | Durée entité parente | Suppression cascade |
| Backups Supabase (PITR) | 30 jours | Auto-purge |

---

## Contact DPO / Référent RGPD

- **Email** : dpo@edutrack.example.com
- **Délai réponse** : 30 jours max (RGPD Art. 12)
- **Registre des traitements** : Ce document + Supabase Data Processing Addendum