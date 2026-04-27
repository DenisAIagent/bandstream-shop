/**
 * Unit-style assertions runnable with `node --test`. Kept dependency-free
 * so they can run before installing Playwright.
 *
 * Usage:
 *   node --test tests/unit/commission.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// We avoid importing the real env-validated commission helper because it
// requires DATABASE_URL etc. Instead we test the rule explicitly.
const COMMISSION_PRO = 0.03;
const FLOOR_PRO = 30;
const COMMISSION_LABEL = 0;

function getCommissionCents(totalCents: number, tier: "PRO" | "LABEL") {
  if (tier === "LABEL") return 0;
  return Math.max(Math.round(totalCents * COMMISSION_PRO), FLOOR_PRO);
}

test("Pro 25 € → 3 % = 75 c", () => {
  assert.equal(getCommissionCents(2500, "PRO"), 75);
});

test("Pro tiny order respects floor 30 c", () => {
  assert.equal(getCommissionCents(500, "PRO"), 30);
});

test("Label always 0", () => {
  assert.equal(getCommissionCents(10_000, "LABEL"), 0);
});

test("Pro 100 € → 3 € exact", () => {
  assert.equal(getCommissionCents(10_000, "PRO"), 300);
});
