import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Phase 5 — notes & annonces", () => {
  test("l'enseignant accède à Évaluations & notes", async ({ page }) => {
    await loginAs(page, "teacher");
    await page.goto("/app/teacher/grades");
    await expect(
      page.getByRole("heading", { name: /Évaluations/ })
    ).toBeVisible();
    await expect(page.getByText("Classe", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Matière", { exact: true }).first()).toBeVisible();
  });

  test("l'enseignant ouvre la grille de saisie depuis le tableau de bord", async ({
    page,
  }) => {
    await loginAs(page, "teacher");
    await page.getByRole("link", { name: /Saisir les notes/ }).first().click();
    await expect(page).toHaveURL(/\/app\/teacher\/grades/, { timeout: 15_000 });
    // Présélection classe → la liste des évaluations apparaît au plus tard
    // après le choix de la matière.
    await expect(
      page.getByRole("heading", { name: /Évaluations/ })
    ).toBeVisible();
  });

  test("l'enseignant crée une évaluation en brouillon", async ({ page }) => {
    await loginAs(page, "teacher");
    await page.getByRole("link", { name: /Saisir les notes/ }).first().click();
    await expect(page).toHaveURL(/\/app\/teacher\/grades/, { timeout: 15_000 });
    // Choisir la première matière proposée pour la classe présélectionnée.
    const trigs = page.locator('button[role="combobox"]');
    const subjectTrigger = trigs.nth(2);
    await subjectTrigger.click();
    const firstOption = page.getByRole("option").first();
    await firstOption.click();
    await expect(
      page.getByRole("button", { name: "Nouvelle évaluation" })
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Nouvelle évaluation" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Nouvelle évaluation")).toBeVisible();
    const title = `Contrôle E2E ${Date.now()}`;
    await dialog.getByPlaceholder("Devoir surveillé N°1").fill(title);
    await dialog
      .getByRole("button", { name: "Créer l'évaluation" })
      .click();
    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("l'enseignant saisit des notes puis enregistre en brouillon", async ({
    page,
  }) => {
    await loginAs(page, "teacher");
    await page.getByRole("link", { name: /Saisir les notes/ }).first().click();
    await expect(page).toHaveURL(/\/app\/teacher\/grades/, { timeout: 15_000 });
    const trigs = page.locator('button[role="combobox"]');
    await trigs.nth(2).click();
    await page.getByRole("option").first().click();
    // Une évaluation publiée existe (Contrôle n°1) : ouvrir la grille.
    const assessLink = page
      .locator("a[href*='/app/teacher/grades/']")
      .first();
    await assessLink.waitFor({ timeout: 15_000 });
    await page.goto((await assessLink.getAttribute("href"))!);
    await expect(
      page.getByRole("button", { name: /Enregistrer \(brouillon\)/ })
    ).toBeVisible({ timeout: 15_000 });
    const firstScore = page.locator('input[aria-label^="Note de"]').first();
    await firstScore.fill("14");
    await page
      .getByRole("button", { name: "Enregistrer (brouillon)" })
      .click();
    await expect(page.getByText(/enregistrées/)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("le parent accède aux notes d'un enfant", async ({ page }) => {
    await loginAs(page, "parent");
    await page.getByRole("link", { name: "Voir le suivi" }).first().click();
    await expect(page).toHaveURL(/\/app\/parent\/children\//, {
      timeout: 15_000,
    });
    await page.getByRole("link", { name: "Notes" }).click();
    await expect(page).toHaveURL(/\/grades$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /Notes/ })
    ).toBeVisible();
    // Le résumé affiche une moyenne générale (données démo publiées).
    await expect(page.getByText(/Moyenne générale/)).toBeVisible();
  });

  test("le parent consulte les annonces publiées", async ({ page }) => {
    await loginAs(page, "parent");
    await page.goto("/app/parent/announcements");
    await expect(
      page.getByRole("heading", { name: /Annonces/ })
    ).toBeVisible();
    await expect(page.getByText("Rentrée scolaire").first()).toBeVisible();
  });

  test("l'admin gère les annonces (liste avec statut)", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/app/admin/announcements");
    await expect(
      page.getByRole("heading", { name: /Annonces/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Nouvelle annonce/ })
    ).toBeVisible();
  });
});