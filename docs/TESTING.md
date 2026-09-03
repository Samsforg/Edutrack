# Testing Strategy — EduTrack

## Pyramide de Tests

```
        E2E (Playwright)          ← 10-20 tests critiques
       /                          \
      Integration (API/DB)        ← ~30 tests
     /                            \
    Unit (Vitest)                 ← 100+ tests
   /                              \
  Static (Lint/Typecheck)         ← CI gate
```

## 1. Tests Unitaires (Vitest)

### Emplacement
```
tests/unit/
├── ai-risk-config.test.ts      # Config risk engine
├── ai-engine.test.ts           # Engine pur (score, sévérité, reco)
├── ai-detect.test.ts           # Détection + déduplication
├── ai-providers.test.ts        # Statistical/Mock providers
├── academic-years.test.ts
├── academic.test.ts
├── attendance.test.ts
├── billing.test.ts
├── import.test.ts
├── link-codes.test.ts
├── permissions.test.ts
```

### Conventions
```typescript
// Pattern standard
import { describe, expect, it, vi } from "vitest";
import { functionUnderTest } from "@/lib/module";

describe("lib/module.ts", () => {
  describe("functionName", () => {
    it("comportement attendu", () => {
      expect(functionUnderTest(input)).toBe(expected);
    });
  });
});
```

### Helpers de test
```typescript
// tests/unit/helpers.ts
export function daysFromNow(days: number): string { ... }
export function sub(overrides: Partial<SchoolSubscription>): SchoolSubscription { ... }
```

### Couverture Cible
| Module | Couverture Min |
|--------|----------------|
| Risk Engine | 95% |
| Billing/Entitlements | 90% |
| AI Providers | 85% |
| Utils/Helpers | 80% |

### Commandes
```bash
npm run test              # Tous les tests unitaires
npm run test:watch        # Mode watch
npm run test -- --reporter=verbose  # Verbose
npm run test -- tests/unit/ai-engine.test.ts  # Fichier unique
```

---

## 2. Tests d'Intégration

### API Routes
```typescript
// tests/integration/api/attendance.test.ts
import { createClient } from "@supabase/supabase-js";

describe("POST /api/attendance", () => {
  it("créé présence prof autorisé", async () => { ... });
  it("rejeté prof non affecté", async () => { ... });
  it("rejeté parent", async () => { ... });
});
```

### Database (Supabase Local)
```bash
# Démarrer Supabase local
supabase start

# Tests contre DB locale
npm run test:integration
```

### RLS Tests (Critique)
```typescript
// tests/integration/rls/parent.test.ts
describe("RLS Parent Isolation", () => {
  it("parent A ne voit pas enfants parent B", async () => {
    const supabaseA = createClient(url, anon, { auth: { persistSession: false } });
    await supabaseA.auth.signInWithPassword({ email: "parentA@test", password: "..." });
    const { data } = await supabaseA.from("students").select("*");
    expect(data.every(s => s.parent_id === parentAId)).toBe(true);
  });
});
```

### Scripts RLS Existants (Phases 4-6)
```bash
npx tsx scripts/attendance-security-check.ts   # 14 assertions
npx tsx scripts/grades-security-check.ts       # 16 assertions
npx tsx scripts/parent-linking-security-check.ts # 13 assertions
npx tsx scripts/import-security-check.ts       # 13 assertions
```

---

## 3. Tests E2E (Playwright)

### Emplacement
```
tests/e2e/
├── auth.spec.ts                    # Login, register, logout
├── attendance.spec.ts              # Saisie présence prof
├── attendance-live.spec.ts         # Realtime présence
├── dashboards.spec.ts              # Dashboards par rôle
├── linking.spec.ts                 # Liaison parent-enfant
├── phase5-grades.spec.ts           # Notes, évaluations
├── school-management.spec.ts       # Admin école
├── super-admin.spec.ts             # Super-admin
```

### Scénarios Critiques (Doit passer avant release)

#### Parent
```typescript
// tests/e2e/parent-flow.spec.ts
test("Parent complet", async ({ page }) => {
  await page.goto("/login");
  await login(page, "parent@demo", "password");
  await expect(page).toHaveURL("/app/parent");
  await page.click("text=Mon enfant");
  await expect(page).toHaveURL(/\/app\/parent\/children\/.*/);
  await page.click("text=Assiduité");
  await expect(page.locator("text=Présent")).toBeVisible();
  await page.click("text=Notes");
  await expect(page.locator("text=Moyenne")).toBeVisible();
  await page.click("text=Notifications");
});
```

#### Teacher
```typescript
// tests/e2e/teacher-flow.spec.ts
test("Teacher présence + notes", async ({ page }) => {
  await login(page, "teacher@demo", "password");
  await expect(page).toHaveURL("/app/teacher");
  await page.click("text=Assiduité");
  await page.selectOption("select#class", "6ème A");
  await page.click("button:has-text(Présent)"); // sur premier élève
  await page.click("text=Enregistrer");
  await expect(page.locator("text=Enregistré")).toBeVisible();
  
  await page.click("text=Évaluations");
  await page.click("text=Créer évaluation");
  // ... remplir formulaire
  await page.click("text=Publier notes");
  await expect(page.locator("text=Publié")).toBeVisible();
});
```

#### School Admin
```typescript
// tests/e2e/admin-flow.spec.ts
test("Admin gestion école", async ({ page }) => {
  await login(page, "admin@demo", "password");
  await expect(page).toHaveURL("/app/admin");
  
  // Créer classe
  await page.click("text=Classes");
  await page.click("text=Nouvelle classe");
  await page.fill("input[name=name]", "6ème Test");
  await page.click("text=Créer");
  
  // Créer élève
  await page.click("text=Élèves");
  await page.click("text=Nouvel élève");
  // ...
  
  // Vérifier analytics
  await page.click("text=Analyse");
  await expect(page.locator("text=Taux de présence")).toBeVisible();
});
```

#### Super Admin
```typescript
// tests/e2e/super-admin-flow.spec.ts
test("Super-admin pilotage", async ({ page }) => {
  await login(page, "superadmin@demo", "password");
  await expect(page).toHaveURL("/app/super-admin");
  
  // Voir écoles
  await expect(page.locator("text=Écoles")).toBeVisible();
  
  // AI control center
  await page.click("text=IA");
  await expect(page.locator("text=Feature flags")).toBeVisible();
  await page.click("button:has-text(Detect attendance risks)");
  await expect(page.locator("text=Job enfile")).toBeVisible();
});
```

#### Security (Cross-School)
```typescript
// tests/e2e/security.spec.ts
test("Isolation cross-school", async ({ page, context }) => {
  // Login School A admin
  const pageA = await context.newPage();
  await login(pageA, "adminA@demo", "password");
  
  // Login School B admin
  const pageB = await context.newPage();
  await login(pageB, "adminB@demo", "password");
  
  // Admin A ne voit pas élèves School B
  await pageA.goto("/app/admin/students");
  await expect(pageA.locator("text=Élève École B")).not.toBeVisible();
  
  // Teacher A ne voit pas classes School B
  // Parent A ne voit pas enfants School B
});
```

### Commandes Playwright
```bash
npm run test:e2e                    # Tous
npm run test:e2e -- --project=chromium  # Navigateur unique
npm run test:e2e -- --grep "Parent"     # Filtre
npm run test:e2e -- --headed            # Visuel
npm run test:e2e -- --debug             # Debug mode
```

---

## 4. Tests de Charge (k6)

### Script Exemple
```javascript
// tests/load/login-dashboard.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 50 },
    { duration: "5m", target: 100 },
    { duration: "2m", target: 200 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const loginRes = http.post("https://staging.edutrack.example.com/api/auth/login", {
    email: `test${__VU}@loadtest.com`,
    password: "loadtest123",
  });
  check(loginRes, { "login ok": (r) => r.status === 200 });
  
  const dashboardRes = http.get("https://staging.edutrack.example.com/app/admin");
  check(dashboardRes, { "dashboard ok": (r) => r.status === 200 });
  
  sleep(1);
}
```

### Exécution
```bash
# Sur Staging uniquement
k6 run tests/load/login-dashboard.js
```

### Cibles
| VUs | P95 Latency | Error Rate |
|-----|-------------|------------|
| 50  | < 500ms     | < 0.1%     |
| 100 | < 1s        | < 0.5%     |
| 200 | < 2s        | < 1%       |

---

## 5. CI/CD Gates

### GitHub Actions (`.github/workflows/ci.yml`)
```yaml
jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test

  build:
    needs: [lint-and-typecheck, unit-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

### Staging Workflow
```yaml
# .github/workflows/staging.yml
on:
  push:
    branches: [develop]
jobs:
  deploy-staging:
    needs: [lint-and-typecheck, unit-tests, build]
    runs-on: ubuntu-latest
    steps:
      - run: npx vercel --token=${{ secrets.VERCEL_TOKEN }} --scope=team --prod=false
  e2e-staging:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - run: npx playwright test --config=playwright.staging.config.ts
```

---

## 6. Checklist Release (Tests)

Avant toute release (tag `vX.Y.Z`) :
- [ ] `npm run lint` → 0 erreurs
- [ ] `npm run typecheck` → 0 erreurs
- [ ] `npm run test` → 100% pass (unit + integration)
- [ ] `npm run build` → succès
- [ ] `npm run test:e2e` sur Staging → 100% pass (scénarios critiques)
- [ ] `k6 run tests/load/...` sur Staging → cibles atteintes
- [ ] Scripts RLS (`attendance-security-check.ts`, etc.) → 100% pass
- [ ] `data-integrity-check.sql` → 0 erreurs critiques