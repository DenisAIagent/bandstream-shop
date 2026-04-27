import { test, expect } from "@playwright/test";

// Pure logic tests through public Next.js APIs would require a running DB.
// This file checks UI guarantees about pricing transparency.

test("page produit affiche un CTA d'achat clair", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/3 %/)).toBeVisible();
  await expect(page.getByText(/10 €/)).toBeVisible();
});
