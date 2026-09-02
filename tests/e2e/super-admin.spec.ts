import { test, expect } from "@playwright/test";

test.describe("Super-admin", () => {
  test("platform overview shows the demo school", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/Email/).fill("superadmin@demo.edutrack");
    await page.getByLabel(/Mot de passe/).fill("demo-superadmin1!");
    await page.getByRole("button", { name: /Se connecter/ }).click();
    await page.waitForURL("**/app/super-admin**", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Plateforme" })).toBeVisible();
    await expect(page.getByText("Établissement Démo EduTrack")).toBeVisible();
  });

  test("can create a new school", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/Email/).fill("superadmin@demo.edutrack");
    await page.getByLabel(/Mot de passe/).fill("demo-superadmin1!");
    await page.getByRole("button", { name: /Se connecter/ }).click();
    await page.waitForURL("**/app/super-admin**", { timeout: 20_000 });

    const code = `CIP-${Date.now().toString(36).toUpperCase()}`;
    await page.getByRole("button", { name: /Nouvel établissement/ }).click();
    await page.getByLabel(/Nom de l.établissement/).fill("Collège E2E");
    await page.getByLabel(/Code/).fill(code);
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(page.getByText("Collège E2E").first()).toBeVisible();
  });

  test("duplicate school code shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/Email/).fill("superadmin@demo.edutrack");
    await page.getByLabel(/Mot de passe/).fill("demo-superadmin1!");
    await page.getByRole("button", { name: /Se connecter/ }).click();
    await page.waitForURL("**/app/super-admin**", { timeout: 20_000 });

    await page.getByRole("button", { name: /Nouvel établissement/ }).click();
    await page.getByLabel(/Nom de l.établissement/).fill("Doublon E2E");
    await page.getByLabel(/Code/).fill("DEMO");
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(page.getByText(/existe déjà/)).toBeVisible();
  });
});