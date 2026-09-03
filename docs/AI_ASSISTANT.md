# Assistant EduTrack — Pipeline sécurisé

## Architecture

```
User question
    │
    ▼
┌─────────────────────────────────────┐
│ 1. AUTHENTIFICATION                 │
│    getSession() → user + memberships │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2. RÔLE & AUTORISATION              │
│    requireRole([SCHOOL_ADMIN])      │
│    (aussi TEACHER, PARENT, SUPER_ADMIN) │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 3. RÉSOLUTION DU SCOPE (PÉRIMÈTRE)  │
│    PARENT   → ses enfants (RLS)     │
│    TEACHER  → ses classes (RLS)     │
│    ADMIN    → son école             │
│    SUPER    → tout                  │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 4. RÉCUPÉRATION DATA CONTEXTUELLE   │
│    listInsights({schoolId, studentId?, classId?, status:"active", limit:8}) │
│    → max 8 insights actifs seulement │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 5. CONSTRUCTION PROMPT (SERVER)     │
│    - Rôle utilisateur               │
│    - Règle FR obligatoire           │
│    - Règle données interdites       │
│    - Contexte déjà filtré           │
│    - Question utilisateur           │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 6. APPEL GATEWAY                    │
│    aiGateway.generateText({prompt}) │
│    → StatisticalProvider (défaut)   │
│    → LLMProvider si configuré       │
│    → Fallback auto si erreur        │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 7. AUDIT & USAGE                    │
│    recordAiAudit({action:"assistant.query"}) │
│    bumpAiUsage({requests: 1})       │
└─────────────────────────────────────┘
```

## Page

`/app/admin/assistant` (SCHOOL_ADMIN) — composant client `AssistantChat` appelle server action `askSchoolAssistant(question)`.

## Règles prompt (lib/ai/prompts/index.ts)

```typescript
const FRENCH_RULE = "Réponds UNIQUEMENT en français.";
const FORBIDDEN_RULE = `
INTERDIT d'inclure : emails, téléphones, adresses, IDs bruts, hash, tokens, mots de passe,
numéros de carte, IBAN, données de santé, notes brutes non agrégées.
`;
```

## Exemples questions

- "Quels élèves sont à surveiller cette semaine ?"
- "Quelle est la tendance d'assiduité ?"
- "Quelles classes ont le plus de risques ?"
- "Montre-moi les signaux pour la classe 6ème A."

## Réponse type (StatisticalProvider)

```
Périmètre : École
Sources : 3
Moteur : statistical

Voici les signaux à surveiller :
[high] Risque d'assiduité — Élève Jean Dupont : 25% d'absences. Recommandation : Échanger avec le parent...
[medium] Baisse de performance — Classe 6ème A : moyenne passée de 13 à 11. Recommandation : Renforcer le suivi...
[info] Progression — Élève Marie Martin : moyenne +2.1 pts. Recommandation : Encourager...
```

## Sécurité

- **Jamais** toutes les données envoyées au LLM
- **Scope RLS** : parent ne voit que ses enfants, teacher ses classes
- **Fallback** : StatisticalProvider si LLM down
- **Audit** : chaque query logguée dans `ai_audit_logs`
- **Quota** : `assistant` compte dans `requests_month`

## Feature flag

`ai_assistant` (rollout : pilot → beta → enabled). Désactivé par défaut.

## Tests

Pas de test E2E sur LLM (pas configuré). Tests unitaires sur `askAssistant` avec MockProvider.