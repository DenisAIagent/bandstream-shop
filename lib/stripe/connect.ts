import { getStripe } from "./client";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import type { ShopArtist } from "@prisma/client";

const STRIPE_SUPPORTED_COUNTRIES = new Set([
  "FR", "BE", "CH", "DE", "ES", "IT", "LU", "MC", "NL", "PT",
  "AT", "DK", "FI", "GB", "IE", "NO", "PL", "SE", "US", "CA",
]);

export async function createOrGetConnectAccount(artist: ShopArtist) {
  const stripe = getStripe();

  const existing = await prisma.stripeConnectAccount.findUnique({
    where: { artistId: artist.id },
  });
  if (existing) return existing;

  const country = STRIPE_SUPPORTED_COUNTRIES.has(artist.countryCode)
    ? artist.countryCode
    : "FR";

  const account = await stripe.accounts.create({
    type: "express",
    country,
    email: artist.email,
    business_type: "individual",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      name: artist.artistName,
      product_description: "Music merchandise sold via band.stream",
      mcc: "5735", // Record stores
    },
    metadata: {
      bs_artist_id: artist.id,
      bs_artist_slug: artist.slug,
    },
  });

  return prisma.stripeConnectAccount.create({
    data: {
      artistId: artist.id,
      stripeAccountId: account.id,
    },
  });
}

export async function createOnboardingLink(
  stripeAccountId: string,
): Promise<string> {
  const env = getEnv();
  const stripe = getStripe();
  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${env.NEXT_PUBLIC_APP_URL}/shop/activate?refresh=1`,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/shop/activate?return=1`,
    type: "account_onboarding",
    collect: "eventually_due",
  });
  return link.url;
}

export async function refreshConnectStatus(stripeAccountId: string) {
  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(stripeAccountId);
  const updated = await prisma.stripeConnectAccount.update({
    where: { stripeAccountId },
    data: {
      kycStatus: account.charges_enabled && account.payouts_enabled ? "ACTIVE" : "PENDING",
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      detailsSubmitted: account.details_submitted,
    },
  });
  return updated;
}
