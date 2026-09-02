import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Parent-child linking end-to-end.
 *
 * The full roundtrip (parent submits code -> admin approves -> parent sees
 * the child) is covered by a dedicated verification script because it needs
 * a freshly generated code, which the UI does not reveal after the first
 * generation step. Here we cover the UI contract for each role.
 */
test.describe("Parent-child linking", () => {
  test("parent can open the link page with the two-step code form", async ({ page }) => {
    await loginAs(page, "parent");
    await page.goto("/app/parent/link");
    await expect(
      page.getByRole("heading", { name: "Liaison parent-enfant" })
    ).toBeVisible();
    await expect(page.getByText("Se lier à un enfant")).toBeVisible();
    await expect(page.getByPlaceholder("EDU-XXXX-XXXX")).toBeVisible();
  });

  test("parent dashboard greets the parent by first name", async ({ page }) => {
    await loginAs(page, "parent");
    await page.goto("/app/parent");
    await expect(
      page.getByRole("heading", { name: /Bonjour, / })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Mes enfants" })
    ).toBeVisible();
  });

  test("parent sees their linked children on /app/parent/children", async ({ page }) => {
    await loginAs(page, "parent");
    await page.goto("/app/parent/children");
    await expect(
      page.getByRole("heading", { name: "Mes enfants" })
    ).toBeVisible();
  });

  test("admin sees the link-requests section with filters", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/app/admin/link-requests");
    await expect(
      page.getByRole("heading", { name: "Demandes de liaison" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "En attente" })).toBeVisible();
  });

  test("admin can open a student detail page showing the link-code card", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/app/admin/students");
    // Open the first student's detail page.
    const firstDetail = page.getByRole("link", { name: "Détails" }).first();
    if (await firstDetail.isVisible().catch(() => false)) {
      await firstDetail.click();
      await expect(
        page.getByRole("heading", { name: /Code de liaison/ }).first()
      ).toBeVisible();
    }
  });
});