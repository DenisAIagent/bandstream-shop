import { getStripe } from "./client";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { getCommission } from "@/lib/pricing/commission";
import { quoteShipping } from "@/lib/shipping/calc";

export interface CheckoutInput {
  productId: string;
  variantId: string;
  country: string;
  fanEmail: string;
  fanName: string;
  shopSlug: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export async function startCheckoutForVariant(input: CheckoutInput): Promise<string> {
  const env = getEnv();
  const stripe = getStripe();

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    include: {
      variants: true,
      images: { orderBy: { position: "asc" } },
      shop: {
        include: {
          shippingZones: true,
          artist: { include: { stripeAccount: true } },
        },
      },
    },
  });
  if (!product || product.status !== "PUBLISHED") {
    throw new Error("Produit indisponible");
  }
  const variant = product.variants.find((v) => v.id === input.variantId);
  if (!variant) throw new Error("Variante introuvable");
  if (variant.stock <= 0) throw new Error("Rupture de stock");

  const shop = product.shop;
  const artist = shop.artist;
  if (artist.status !== "ACTIVE") throw new Error("Boutique indisponible");
  const stripeAccount = artist.stripeAccount;
  if (!stripeAccount || !stripeAccount.chargesEnabled) {
    throw new Error("Compte vendeur non vérifié");
  }

  const subtotal = variant.priceCents;
  const quote = quoteShipping({
    subtotalCents: subtotal,
    zones: shop.shippingZones,
    countryCode: input.country,
  });
  if (!quote) throw new Error("Pays non desservi par cette boutique");

  const total = subtotal + quote.shippingCents;
  const { applicationFeeCents } = getCommission(total, artist.tier);

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      currency: "eur",
      customer_email: input.fanEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: variant.priceCents,
            product_data: {
              name: product.title,
              description: [variant.size, variant.color].filter(Boolean).join(" / ") || undefined,
              images: product.images.slice(0, 3).map((i) => i.url),
              metadata: {
                bs_product_id: product.id,
                bs_variant_id: variant.id,
              },
            },
          },
        },
      ],
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: `${quote.carrier} (${quote.estimatedDays} j)`,
            fixed_amount: { amount: quote.shippingCents, currency: "eur" },
          },
        },
      ],
      shipping_address_collection: { allowed_countries: [input.country as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry] },
      payment_intent_data: {
        application_fee_amount: applicationFeeCents,
        transfer_data: { destination: stripeAccount.stripeAccountId },
        metadata: {
          bs_shop_id: shop.id,
          bs_product_id: product.id,
          bs_variant_id: variant.id,
          bs_artist_slug: artist.slug,
        },
      },
      metadata: {
        bs_shop_id: shop.id,
        bs_product_id: product.id,
        bs_variant_id: variant.id,
        bs_artist_slug: artist.slug,
        bs_fan_name: input.fanName,
        bs_subtotal_cents: String(subtotal),
        bs_shipping_cents: String(quote.shippingCents),
        bs_application_fee_cents: String(applicationFeeCents),
        bs_country: input.country,
        utm_source: input.utmSource ?? "",
        utm_medium: input.utmMedium ?? "",
        utm_campaign: input.utmCampaign ?? "",
      },
      success_url: `${env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/${input.shopSlug}/${product.slug}?cancelled=1`,
    },
  );
  if (!session.url) throw new Error("Stripe n'a pas retourné d'URL");
  return session.url;
}

// Avoid forcing types on shipping countries union by re-importing from stripe types.
import type Stripe from "stripe";
