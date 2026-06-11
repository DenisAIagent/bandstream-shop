import type Stripe from "stripe";
import { getStripe } from "./client";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { getCommission } from "@/lib/pricing/commission";
import { quoteCart } from "@/lib/cart/quote";
import { reserveDiscountUse } from "@/lib/cart/discount";
import { readCart } from "@/lib/cart/cookie";

export interface CheckoutCartInput {
  shopId: string;
  shopSlug: string;
  country: string;
  fanEmail: string;
  fanName: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

/**
 * Lance un Stripe Checkout multi-line à partir du contenu du cookie panier.
 * Recalcule prix, stock et frais de port côté serveur (zéro confiance dans
 * le cookie). Si une variante a disparu / changé de statut / passé en
 * rupture, on lève une erreur explicite que la page panier traduit en UI.
 */
export async function startCheckoutForCart(
  input: CheckoutCartInput,
): Promise<string> {
  const env = getEnv();
  const stripe = getStripe();

  const shop = await prisma.shop.findUnique({
    where: { id: input.shopId },
    include: {
      artist: { include: { stripeAccount: true } },
    },
  });
  if (!shop) throw new Error("Boutique introuvable");
  if (shop.artist.status !== "ACTIVE") throw new Error("Boutique indisponible");
  const stripeAccount = shop.artist.stripeAccount;
  if (!stripeAccount || !stripeAccount.chargesEnabled) {
    throw new Error("Compte vendeur non vérifié");
  }

  const cart = await readCart(input.shopId);
  if (cart.items.length === 0) throw new Error("Panier vide");

  const quote = await quoteCart({
    shopId: input.shopId,
    cart,
    country: input.country,
  });
  if (quote.lines.length === 0) throw new Error("Panier vide");
  if (quote.hasOutOfStock) {
    throw new Error("Un ou plusieurs articles sont en rupture, panier mis à jour");
  }
  // Le port n'est exigé que si le panier contient un article physique. Un
  // panier 100 % digital n'a ni adresse ni frais de port.
  if (quote.requiresShipping && (!quote.shipping || quote.countryNotCovered)) {
    throw new Error("Pays non desservi par cette boutique");
  }

  // Réservation atomique du code promo : c'est ici que le prix remisé est
  // figé dans la session Stripe, donc c'est ici qu'on doit consommer le
  // quota (sinon deux checkouts concurrents dépassent maxUses). L'incrément
  // du webhook est supprimé en conséquence.
  if (quote.discount) {
    const reserved = await reserveDiscountUse({
      shopId: input.shopId,
      code: quote.discount.code,
    });
    if (!reserved) {
      throw new Error(
        "Ce code promo n'est plus disponible. Retire-le pour continuer.",
      );
    }
  }

  const { applicationFeeCents } = getCommission(quote.totalCents, shop.artist.tier);

  // Construit les line_items Stripe — un par variante panier. On met les
  // images du produit dans `product_data.images` (Stripe les affiche).
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: quote.lines.map((l) => l.variantId) } },
    include: {
      product: { include: { images: { orderBy: { position: "asc" } } } },
    },
  });
  // Application de la remise sur le sous-total : on répartit le rabais
  // proportionnellement entre les lignes (au prix unitaire * qty), pour
  // que Stripe affiche un total cohérent. Pour un PERCENT, c'est exact.
  // Pour un FIXED, on accepte un écart d'arrondi de quelques cents au
  // dernier line item.
  const subtotalDiscount = quote.discount?.subtotalDiscountCents ?? 0;
  const subtotalCents = quote.subtotalCents;
  let allocated = 0;
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    quote.lines.map((line, idx) => {
      const v = variants.find((x) => x.id === line.variantId)!;
      const lineSubtotal = line.unitPriceCents * line.quantity;
      let lineDiscount = 0;
      if (subtotalDiscount > 0 && subtotalCents > 0) {
        // Sur la dernière ligne, on absorbe le résidu d'arrondi.
        const isLast = idx === quote.lines.length - 1;
        lineDiscount = isLast
          ? subtotalDiscount - allocated
          : Math.floor((subtotalDiscount * lineSubtotal) / subtotalCents);
        allocated += lineDiscount;
      }
      // Stripe exige unit_amount >= 1 (minimum 1 cent). On clamp au cas
      // où le rabais total ramène la ligne à 0.
      const adjustedUnit = Math.max(
        1,
        Math.floor((lineSubtotal - lineDiscount) / line.quantity),
      );
      return {
        quantity: line.quantity,
        price_data: {
          currency: "eur",
          unit_amount: adjustedUnit,
          product_data: {
            name: line.productTitle,
            description: line.variantLabel ?? undefined,
            images: v.product.images.slice(0, 3).map((i) => i.url),
            metadata: {
              bs_product_id: line.productId,
              bs_variant_id: line.variantId,
            },
          },
        },
      };
    });

  // Port + collecte d'adresse uniquement si le panier contient du physique.
  const shippingParams: Pick<
    Stripe.Checkout.SessionCreateParams,
    "shipping_options" | "shipping_address_collection"
  > =
    quote.requiresShipping && quote.shipping
      ? {
          shipping_options: [
            {
              shipping_rate_data: {
                type: "fixed_amount",
                display_name:
                  quote.discount?.type === "FREE_SHIPPING"
                    ? `${quote.shipping.carrier} — livraison offerte`
                    : `${quote.shipping.carrier} (${quote.shipping.totalDaysMin}-${quote.shipping.totalDaysMax} j)`,
                fixed_amount: {
                  amount: quote.shippingCents, // déjà 0 si FREE_SHIPPING
                  currency: "eur",
                },
              },
            },
          ],
          shipping_address_collection: {
            allowed_countries: [
              input.country as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry,
            ],
          },
        }
      : {};

  // Multi-devises : la session reste en EUR (devise de règlement du vendeur).
  // L'encaissement dans la devise du fan est géré par **Stripe Adaptive
  // Pricing**, activé au niveau du compte (Dashboard Stripe) — voir
  // docs/multi-currency.md. Aucun montant n'est converti côté code : Stripe
  // présente et encaisse la devise locale, on est réglé en EUR. À vérifier sur
  // Stripe live avant prod (notamment que `amount_total` revient bien en EUR).
  // L221-28 13° C. conso : renoncement exprès affiché si le panier contient
  // au moins un contenu numérique téléchargeable (cf. CGV art. 6 bis).
  const hasDigital = quote.lines.some((line) => {
    const v = variants.find((x) => x.id === line.variantId);
    return v?.product.isDigital === true;
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    currency: "eur",
    customer_email: input.fanEmail,
    consent_collection: { promotions: "auto" },
    ...(hasDigital
      ? {
          custom_text: {
            submit: {
              message:
                "En payant, vous demandez l'exécution immédiate de la fourniture des contenus numériques de cette commande et renoncez expressément à votre droit de rétractation pour ces contenus (art. L221-28 13° du Code de la consommation). Le droit de rétractation de 14 jours reste acquis pour les articles physiques.",
            },
          },
        }
      : {}),
    line_items: lineItems,
    ...shippingParams,
    payment_intent_data: {
      application_fee_amount: applicationFeeCents,
      transfer_data: { destination: stripeAccount.stripeAccountId },
      metadata: {
        bs_shop_id: shop.id,
        bs_artist_slug: shop.artist.slug,
        bs_cart_lines: String(quote.lines.length),
      },
    },
    metadata: {
      bs_shop_id: shop.id,
      bs_artist_slug: shop.artist.slug,
      bs_fan_name: input.fanName,
      bs_subtotal_cents: String(quote.subtotalCents),
      bs_shipping_cents: String(quote.shippingCents),
      bs_application_fee_cents: String(applicationFeeCents),
      bs_country: input.country,
      bs_cart_lines: JSON.stringify(
        quote.lines.map((l) => ({
          v: l.variantId,
          q: l.quantity,
          p: l.unitPriceCents,
        })),
      ),
      bs_discount_code: quote.discount?.code ?? "",
      utm_source: input.utmSource ?? "",
      utm_medium: input.utmMedium ?? "",
      utm_campaign: input.utmCampaign ?? "",
    },
    success_url: `${env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}&shop=${input.shopSlug}`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/${input.shopSlug}/panier?cancelled=1`,
  });

  if (!session.url) throw new Error("Stripe n'a pas retourné d'URL");

  // Snapshot pour la relance abandon panier. Si la session expire ou n'est
  // jamais finalisée, le cron `/api/cron/abandoned-carts` enverra un email
  // de relance H+1 au fanEmail. Le webhook `checkout.session.completed`
  // marquera ce row comme `recoveredAt` pour éviter une relance post-conversion.
  await prisma.abandonedCart
    .create({
      data: {
        shopId: shop.id,
        fanEmail: input.fanEmail,
        fanName: input.fanName,
        stripeCheckoutUrl: session.url,
        stripeSessionId: session.id,
        cartSnapshot: {
          lines: quote.lines.map((l) => ({
            variantId: l.variantId,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            productTitle: l.productTitle,
            variantLabel: l.variantLabel ?? null,
          })),
          subtotalCents: quote.subtotalCents,
          shippingCents: quote.shippingCents,
          totalCents: quote.totalCents,
          country: input.country,
        },
      },
    })
    .catch(() => {
      // Best-effort : un échec de snapshot ne doit pas bloquer le checkout.
      // Le pire cas est qu'on ne pourra pas relancer ce panier abandonné.
    });

  return session.url;
}
