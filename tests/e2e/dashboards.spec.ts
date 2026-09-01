import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Dashboards", () => {
  test("admin sees school stats", async ({ page }) => {
    await loginAs(page, "admin");
    await expect(page.getByText("Élèves")).toBeVisible();
    await expect(page.getByText("Enseignants")).toBeVisible();
  });

  test("admin can open the students page", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/app/admin/students");
    await expect(page.getByRole("heading", { name: /Élèves/ })).toBeVisible();
  });

  test("teacher sees the attendance page with a class to fill", async ({ page }) => {
    await loginAs(page, "teacher");
    await page.goto("/app/teacher/attendance");
    await expect(page.getByRole("heading", { name: /Présences/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Enregistrer/ })).toBeVisible();
  });

  test("parent sees at least one linked child", async ({ page }) => {
    await loginAs(page, "parent");
    await expect(page.getByRole("heading", { name: "Espace Parent" })).toBeVisible();
    await expect(page.getByText("Matricule :")).toBeVisible();
  });
});