import { randomInt } from "node:crypto";

export function generateOrderNumber(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const rnd = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return `BS-${y}-${m}-${rnd}`;
}
