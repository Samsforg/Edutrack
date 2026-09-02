import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Phase 4 — présences", () => {
  test("l'enseignant accède à l'historique des appels", async ({ page }) => {
    await loginAs(page, "teacher");
    await page.goto("/app/teacher/attendance/history");
    await expect(
      page.getByRole("heading", { name: /Historique des appels/ })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Filtrer" })).toBeVisible();
  });

  test("le parent voit la section Présence aujourd'hui", async ({ page }) => {
    await loginAs(page, "parent");
    await expect(
      page.getByRole("heading", { name: /Présence aujourd/ })
    ).toBeVisible();
  });

  test("le parent ouvre le suivi assiduité d'un enfant", async ({ page }) => {
    await loginAs(page, "parent");
    const href = await page
      .getByRole("link", { name: "Voir le suivi" })
      .first()
      .getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(href!);
    await expect(page).toHaveURL(new RegExp(`\\${href}`), { timeout: 15_000 });
    await expect(
      page.getByText(/Assiduité/).first()
    ).toBeVisible();
    const historyHref = await page
      .getByRole("link", { name: /Historique complet/ })
      .getAttribute("href");
    expect(historyHref).toBeTruthy();
    await page.goto(historyHref!);
    await expect(page).toHaveURL(/\/attendance$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /Historique de présence/ })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "30 jours" })).toBeVisible();
    await expect(page.getByRole("button", { name: "7 jours" })).toBeVisible();
  });

  test("le parent consulte ses notifications", async ({ page }) => {
    await loginAs(page, "parent");
    await page.goto("/app/parent/notifications");
    await expect(
      page.getByRole("heading", { name: /Notifications/ })
    ).toBeVisible();
  });
});