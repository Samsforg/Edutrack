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
});