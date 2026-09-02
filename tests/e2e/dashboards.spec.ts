import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Dashboards", () => {
  test("admin sees school stats", async ({ page }) => {
    await loginAs(page, "admin");
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
    await expect(page.getByText("Enseignants").first()).toBeVisible();
  });

  test("admin can open the students page", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/app/admin/students");
    await expect(page.getByRole("heading", { name: /Élèves/ })).toBeVisible();
  });

  test("teacher sees their classes and can open attendance", async ({ page }) => {
    await loginAs(page, "teacher");
    await page.goto("/app/teacher/attendance");
    await expect(page.getByRole("heading", { name: /Faire l'appel/ })).toBeVisible();
    const firstClass = page.locator("a[href*='classId=']").first();
    await firstClass.click();
    await expect(page.getByRole("heading", { name: "Appel du jour" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Enregistrer l'appel|Mettre à jour l'appel/ })
    ).toBeVisible();
  });

  test("parent lands on the new parent portal", async ({ page }) => {
    await loginAs(page, "parent");
    await expect(page.getByRole("heading", { name: /Bonjour, / })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mes enfants" })).toBeVisible();
  });
});