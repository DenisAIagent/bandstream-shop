import type { Tier } from "@prisma/client";
import { getEnv } from "@/lib/env";

export interface CommissionResult {
  rate: number;
  floorCents: number;
  applicationFeeCents: number;
}

/**
 * Calcule la commission band.stream à appliquer via `application_fee_amount` Stripe.
 *
 * Tier rules (autoritaire — overrides master doc) :
 *   - PRO   : 3 % avec floor min 30 c
 *   - LABEL : 0 %
 *
 * Modèle A Stripe Connect : les frais Stripe (1,4 % + 0,25 €) sont prélevés
 * directement sur le compte de l'artiste, NON inclus dans cette fonction.
 */
export function getCommission(totalCents: number, tier: Tier): CommissionResult {
  const env = getEnv();
  const rate =
    tier === "LABEL" ? env.COMMISSION_RATE_LABEL : env.COMMISSION_RATE_PRO;
  const floorCents =
    tier === "LABEL"
      ? env.COMMISSION_FLOOR_CENTS_LABEL
      : env.COMMISSION_FLOOR_CENTS_PRO;

  const computed = Math.round(totalCents * rate);
  const applicationFeeCents = rate === 0 ? 0 : Math.max(computed, floorCents);

  return { rate, floorCents, applicationFeeCents };
}
