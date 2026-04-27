import type { Tier } from "@prisma/client";
import { getCommission } from "./commission";

export interface CostBreakdown {
  grossCents: number;
  stripeFeeCents: number;
  commissionCents: number;
  netCents: number;
  rate: number;
}

/**
 * Estimation des frais Stripe EU standard : 1,4 % + 25 c.
 * Utilisée pour l'affichage prévisionnel artiste — la valeur réelle est
 * remontée par Stripe via `balance_transaction` après chaque vente.
 */
const STRIPE_PCT = 0.014;
const STRIPE_FIXED_CENTS = 25;

export function estimateBreakdown(grossCents: number, tier: Tier): CostBreakdown {
  const stripeFeeCents = Math.round(grossCents * STRIPE_PCT) + STRIPE_FIXED_CENTS;
  const { applicationFeeCents, rate } = getCommission(grossCents, tier);
  const netCents = grossCents - stripeFeeCents - applicationFeeCents;
  return {
    grossCents,
    stripeFeeCents,
    commissionCents: applicationFeeCents,
    netCents,
    rate,
  };
}

export function realizedBreakdown(params: {
  grossCents: number;
  applicationFeeCents: number;
  stripeFeeCents: number | null | undefined;
}): CostBreakdown {
  const stripeFeeCents = params.stripeFeeCents ?? 0;
  const netCents =
    params.grossCents - stripeFeeCents - params.applicationFeeCents;
  const rate = params.grossCents > 0 ? params.applicationFeeCents / params.grossCents : 0;
  return {
    grossCents: params.grossCents,
    stripeFeeCents,
    commissionCents: params.applicationFeeCents,
    netCents,
    rate,
  };
}

export function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
