import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Authentication", () => {
  test("admin can log in and reaches the admin dashboard", async ({ page }) => {
    await loginAs(page, "admin");
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  });

  test("wrong password shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/Email/).fill("admin@demo.edutrack");
    await page.getByLabel(/Mot de passe/).fill("wrong-password");
    await page.getByRole("button", { name: /Se connecter/ }).click();
    await expect(page.getByText(/incorrect|invalides/i).first()).toBeVisible();
  });

  test("protected pages redirect to login when logged out", async ({ page }) => {
    await page.goto("/app/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("landing page is public and links to login", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Le lien intelligent/ })
    ).toBeVisible();
    await page.getByRole("link", { name: "Se connecter" }).first().click();
    await expect(page).toHaveURL(/\/login/);
  });
});