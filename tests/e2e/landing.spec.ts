import { test, expect } from "@playwright/test";

test("landing affiche le hook pricing 3 % / 10 €", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("3 %")).toBeVisible();
  await expect(page.getByText("10 €")).toBeVisible();
});

test("la page register exige les CGU", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: /Activer ma boutique/ })).toBeVisible();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="acceptTerms"]')).toBeVisible();
});

test("middleware redirige les routes artist vers /login", async ({ page }) => {
  const res = await page.goto("/dashboard");
  expect(res?.url()).toMatch(/\/login/);
});
