import type { Page } from "@playwright/test";

export const ACCOUNTS = {
  admin: {
    email: "admin@demo.edutrack",
    password: "demo-admin1!",
    home: "/app/admin",
  },
  teacher: {
    email: "teacher1@demo.edutrack",
    password: "demo-teach1!",
    home: "/app/teacher",
  },
  parent: {
    email: "parent1@demo.edutrack",
    password: "demo-parent1!",
    home: "/app/parent",
  },
} as const;

export async function logout(page: Page) {
  await page.goto("/app/account");
  const menu = page.locator('button[aria-haspopup="menu"]').first();
  if (await menu.isVisible().catch(() => false)) {
    await menu.click();
    await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  } else {
    await page.goto("/login");
  }
}

export async function loginAs(
  page: Page,
  account: keyof typeof ACCOUNTS
): Promise<void> {
  const { email, password, home } = ACCOUNTS[account];
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel(/Email/).fill(email);
  await page.getByLabel(/Mot de passe/).fill(password);
  await page.getByRole("button", { name: /Se connecter/ }).click();
  await page.waitForURL(`**${home}**`, { timeout: 20_000 });
}