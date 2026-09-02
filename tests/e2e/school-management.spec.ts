import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

const year = new Date().getFullYear();
const currentYearName = `${year}-${year + 1}`;

test.describe("School management", () => {
  test("admin nav exposes the management sections", async ({ page }) => {
    await loginAs(page, "admin");
    const nav = page.locator("nav");
    for (const label of [
      "Matières",
      "Années scolaires",
      "Parents",
      "Paramètres",
    ]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("subjects page lists seeded subjects", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/app/admin/subjects");
    await expect(page.getByRole("heading", { name: /Matières/ })).toBeVisible();
    for (const code of ["MAT", "FRA", "ANG"]) {
      await expect(page.getByText(code, { exact: true })).toBeVisible();
    }
  });

  test("academic years page shows the current year", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/app/admin/academic-years");
    await expect(
      page.getByRole("heading", { name: /Années scolaires/ })
    ).toBeVisible();
    await expect(page.getByText(currentYearName)).toBeVisible();
    await expect(page.getByText("Année courante")).toBeVisible();
  });

  test("parents page lists the directory", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/app/admin/parents");
    await expect(page.getByRole("heading", { name: /Parents/ })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Ndiaye Fatou" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Sow Ibrahima" })).toBeVisible();
  });

  test("teachers page shows active teachers", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/app/admin/teachers");
    await expect(
      page.getByRole("heading", { name: /Enseignants/ })
    ).toBeVisible();
    await expect(page.getByText("Actif").first()).toBeVisible();
  });

  test("students page supports search and status filter", async ({ page }) => {
    await loginAs(page, "admin");
    await page.locator("nav").getByRole("link", { name: "Élèves" }).click();
    await expect(page.getByRole("heading", { name: /Élèves/ })).toBeVisible();
    await expect(
      page.getByPlaceholder(/Rechercher/).first()
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Filtrer" })).toBeVisible();
  });

  test("admin can update the school profile (RLS 0010)", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/app/admin/settings");
    await expect(
      page.getByRole("heading", { name: /Paramètres/ })
    ).toBeVisible();

    const nameInput = page.getByLabel("Nom de l’établissement");
    const existing = await nameInput.inputValue();
    await nameInput.fill(existing);
    await page.getByLabel("Ville").fill("Dakar");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Paramètres enregistrés")).toBeVisible({
      timeout: 15_000,
    });
  });
});