import type { ShopArtist, Tier } from "@prisma/client";

export class TierGateError extends Error {
  constructor(message: string, public readonly currentTier?: Tier) {
    super(message);
    this.name = "TierGateError";
  }
}

const SHOP_ENABLED_TIERS: ReadonlySet<Tier> = new Set<Tier>(["PRO", "LABEL"]);

export function isShopEnabled(tier: Tier): boolean {
  return SHOP_ENABLED_TIERS.has(tier);
}

/**
 * Garde-fou serveur : refuse l'accès si l'artiste n'est pas Pro ou Label.
 * Utilisé par toutes les Server Actions et API routes touchant la boutique.
 */
export function requirePro(artist: Pick<ShopArtist, "tier"> | null | undefined): asserts artist is Pick<ShopArtist, "tier"> {
  if (!artist) {
    throw new TierGateError("Authentification requise");
  }
  if (!isShopEnabled(artist.tier)) {
    throw new TierGateError(
      "Cette fonctionnalité nécessite le plan Pro (10 €/mois). Mettez votre compte à niveau pour activer la boutique.",
      artist.tier,
    );
  }
}
