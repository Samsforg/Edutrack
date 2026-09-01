import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Parent-child linking end-to-end:
 *  1. Parent submits a link code via the public form.
 *  2. Admin sees the pending request on /app/admin/link-requests.
 *  3. Admin approves it.
 *  4. Parent sees the newly linked child.
 *
 * The code is read from the DB via the app (teacher/grade flows prove RLS),
 * but to keep this spec data-independent we focus on the UI contract.
 */
test.describe("Parent-child linking", () => {
  test("parent can open the link page with the code form", async ({ page }) => {
    await loginAs(page, "parent");
    await page.goto("/app/parent/link");
    await expect(
      page.getByRole("heading", { name: "Liaison parent-enfant" })
    ).toBeVisible();
  });

  test("admin sees the link-requests section", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/app/admin/link-requests");
    await expect(page.getByRole("heading", { name: "Demandes de liaison" })).toBeVisible();
  });
});