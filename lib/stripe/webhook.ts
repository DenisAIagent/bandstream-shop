import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/order-number";
import { sendEmail } from "@/lib/notifications/email";
import {
  artistOrderNotification,
  fanOrderConfirmation,
  fanRefundNotification,
} from "@/lib/notifications/templates";
import { syncProductToGmc, removeProductFromGmc } from "@/lib/gmc/sync";
import { syncProductToMeta, removeProductFromMeta } from "@/lib/meta/sync";
import { issueInvoiceFields, SHOP_INVOICE_SELECT } from "@/lib/invoices/issue";
import { signInvoiceToken } from "@/lib/invoices/token";
import { issueDownloadGrants } from "@/lib/digital/deliver";
import { refreshConnectStatus } from "./connect";

/** URL signée vers la facture d'une commande (lien fan dans l'email). */
function buildInvoiceUrl(orderId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  return `${base.replace(/\/$/, "")}/api/invoices/${orderId}?t=${signInvoiceToken(orderId)}`;
}

/**
 * Extrait les produits digitaux distincts (avec au moins un fichier) d'un
 * ensemble de lignes panier, pour émettre un lien de téléchargement par
 * produit.
 */
function dedupeDigitalProducts(
  lines: Array<{
    variant: {
      product: { id: string; title: string; isDigital: boolean; _count: { digitalAssets: number } };
    };
  }>,
): Array<{ id: string; title: string }> {
  const map = new Map<string, { id: string; title: string }>();
  for (const { variant } of lines) {
    const p = variant.product;
    if (p.isDigital && p._count.digitalAssets > 0 && !map.has(p.id)) {
      map.set(p.id, { id: p.id, title: p.title });
    }
  }
  return [...map.values()];
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      await markAbandonedCartRecovered(event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.expired":
      await markAbandonedCartExpired(event.data.object as Stripe.Checkout.Session);
      break;
    case "charge.refunded":
      await onChargeRefunded(event.data.object as Stripe.Charge);
      break;
    case "account.updated":
      await onAccountUpdated(event.data.object as Stripe.Account);
      break;
    default:
      // Ignored event — keep the webhook idempotent and tolerant.
      break;
  }
}

interface CartLineMeta {
  v: string; // variantId
  q: number; // qty
  p: number; // unitPriceCents (snapshot au moment du checkout)
}

function parseCartLines(raw: string | undefined | null): CartLineMeta[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CartLineMeta[];
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (l) =>
        typeof l?.v === "string" &&
        typeof l?.q === "number" &&
        l.q > 0 &&
        typeof l?.p === "number",
    );
  } catch {
    return null;
  }
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== "paid") return;
  const md = session.metadata ?? {};
  const shopId = md.bs_shop_id;
  if (!shopId) return;

  // Branche multi-lignes (panier) si `bs_cart_lines` présent.
  // Branche single-line (legacy direct buy) sinon.
  const cartLines = parseCartLines(md.bs_cart_lines);
  if (cartLines && cartLines.length > 0) {
    await onCheckoutCompletedMultiLine(session, shopId, cartLines);
    return;
  }

  const productId = md.bs_product_id;
  const variantId = md.bs_variant_id;
  if (!productId || !variantId) return;

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!paymentIntentId) return;

  const existing = await prisma.order.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
  if (existing) return; // already processed (idempotent)

  const subtotal = Number(md.bs_subtotal_cents ?? 0);
  const shippingCents = Number(md.bs_shipping_cents ?? 0);
  const applicationFee = Number(md.bs_application_fee_cents ?? 0);
  const total = session.amount_total ?? subtotal + shippingCents;
  const fanEmail = session.customer_details?.email ?? session.customer_email ?? "";
  // Opt-in marketing coché (ou non) par le fan sur la page Stripe Checkout.
  const marketingOptIn = session.consent?.promotions === "opt_in";
  const fanName = session.customer_details?.name ?? md.bs_fan_name ?? "";
  const toJson = (a: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
    a ? (JSON.parse(JSON.stringify(a)) as Prisma.InputJsonValue) : Prisma.JsonNull;
  const shippingAddress = toJson(session.shipping_details?.address ?? session.customer_details?.address);
  const billingAddress = toJson(session.customer_details?.address);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: true,
      shop: {
        select: {
          ...SHOP_INVOICE_SELECT,
          artist: { select: { email: true, artistName: true } },
        },
      },
    },
  });
  const variant = product?.variants.find((v) => v.id === variantId);
  if (!product || !variant) return;

  // Atomic: decrement stock + émission facture (n° séquentiel + TVA) + create
  // order, le tout dans une transaction interactive pour garantir l'atomicité
  // stock + numéro + commande.
  // Les variantes en pré-commande sont autorisées à passer en stock négatif
  // (backorder) : le guard `stock >= 1` ne s'applique qu'aux variantes en
  // vente classique, sinon un achat pré-commande légitime (stock 0) lèverait
  // P2025 et déclencherait un remboursement automatique indu.
  const issuedAt = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: variant.isPreorder
          ? { id: variantId }
          : ({ id: variantId, stock: { gte: 1 } } as Prisma.ProductVariantWhereUniqueInput),
        data: { stock: { decrement: 1 } },
      });
      const inv = await issueInvoiceFields(tx, product.shop, total, issuedAt);
      await tx.order.create({
        data: {
          publicNumber: generateOrderNumber(),
          shopId,
          fanEmail,
          fanName,
          marketingOptIn,
          shippingAddress,
          billingAddress,
          subtotalCents: subtotal || total - shippingCents,
          shippingCents,
          totalCents: total,
          stripePaymentIntentId: paymentIntentId,
          applicationFeeCents: applicationFee,
          status: "PAID",
          taxCents: inv.taxCents,
          taxRateBps: inv.taxRateBps,
          vatExempt: inv.vatExempt,
          invoiceNumber: inv.invoiceNumber,
          invoicedAt: inv.invoicedAt,
          sellerSnapshot: inv.sellerSnapshot,
          utmSource: md.utm_source || null,
          utmMedium: md.utm_medium || null,
          utmCampaign: md.utm_campaign || null,
          items: {
            create: [
              {
                productId: product.id,
                variantId: variant.id,
                titleSnapshot: product.title,
                variantSnapshot: [variant.size, variant.color].filter(Boolean).join(" / ") || null,
                unitPriceCents: variant.priceCents,
                quantity: 1,
              },
            ],
          },
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      // Stock was already 0 by the time the webhook landed. Refund automatically.
      try {
        const { getStripe } = await import("@/lib/stripe/client");
        await getStripe().refunds.create({
          payment_intent: paymentIntentId,
          refund_application_fee: true,
          reverse_transfer: true,
        });
      } catch {
        // last-resort: log the situation; an ops alert hook can be added in V1.1
      }
      return;
    }
    throw e;
  }

  const created = await prisma.order.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { items: true, shop: { include: { artist: true } } },
  });
  if (!created) return;

  // Side effects: emails + sync external catalogs (stock changed → maybe out_of_stock)
  await Promise.allSettled([
    sendEmail({
      to: created.fanEmail,
      ...fanOrderConfirmation({
        publicNumber: created.publicNumber,
        fanName: created.fanName,
        fanEmail: created.fanEmail,
        totalCents: created.totalCents,
        subtotalCents: created.subtotalCents,
        shippingCents: created.shippingCents,
        items: created.items.map((i) => ({
          titleSnapshot: i.titleSnapshot,
          variantSnapshot: i.variantSnapshot,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
        })),
        shopDisplayName: created.shop.displayName,
        shopContactEmail: created.shop.contactEmail,
        invoiceUrl: buildInvoiceUrl(created.id),
      }),
      replyTo: created.shop.contactEmail,
    }),
    sendEmail({
      to: created.shop.artist.email,
      ...artistOrderNotification({
        publicNumber: created.publicNumber,
        fanName: created.fanName,
        fanEmail: created.fanEmail,
        totalCents: created.totalCents,
        subtotalCents: created.subtotalCents,
        shippingCents: created.shippingCents,
        items: created.items.map((i) => ({
          titleSnapshot: i.titleSnapshot,
          variantSnapshot: i.variantSnapshot,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
        })),
        shopDisplayName: created.shop.displayName,
        shopContactEmail: created.shop.contactEmail,
      }),
    }),
    syncProductToGmc(created.shopId, product.id),
    syncProductToMeta(created.shopId, product.id),
  ]);
}

async function onChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;
  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { items: true, shop: true },
  });
  if (!order) return;

  const refundedCents = charge.amount_refunded ?? 0;
  const fullyRefunded = refundedCents >= order.totalCents;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: fullyRefunded ? "REFUNDED" : order.status,
        refundedAt: new Date(),
        refundedAmountCents: refundedCents,
      },
    });
    if (fullyRefunded) {
      // Restock items
      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
        }
      }
    }
  });

  // Re-sync if products are back in stock
  for (const item of order.items) {
    if (fullyRefunded) {
      await syncProductToGmc(order.shopId, item.productId).catch(() => null);
      await syncProductToMeta(order.shopId, item.productId).catch(() => null);
    }
  }

  await sendEmail({
    to: order.fanEmail,
    ...fanRefundNotification(
      {
        publicNumber: order.publicNumber,
        fanName: order.fanName,
        fanEmail: order.fanEmail,
        totalCents: order.totalCents,
        subtotalCents: order.subtotalCents,
        shippingCents: order.shippingCents,
        items: order.items.map((i) => ({
          titleSnapshot: i.titleSnapshot,
          variantSnapshot: i.variantSnapshot,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
        })),
        shopDisplayName: order.shop.displayName,
        shopContactEmail: order.shop.contactEmail,
      },
      refundedCents,
    ),
  }).catch(() => null);
  // (avoid never-read suppression for unused remove imports here; refunds re-stock then re-sync above)
  void removeProductFromGmc;
  void removeProductFromMeta;
}

async function onAccountUpdated(account: Stripe.Account): Promise<void> {
  await refreshConnectStatus(account.id).catch(() => null);
}

/**
 * Handler dédié aux Checkout Sessions issues d'un panier multi-produits.
 * Idempotent (vérifie l'existence par PaymentIntent), atomique (stock
 * décrément + Order create dans la même transaction). En cas de stock
 * insuffisant côté DB au moment du webhook (race avec un autre achat),
 * on rembourse intégralement et on log.
 */
async function onCheckoutCompletedMultiLine(
  session: Stripe.Checkout.Session,
  shopId: string,
  cartLines: CartLineMeta[],
): Promise<void> {
  const md = session.metadata ?? {};
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId) return;

  const existing = await prisma.order.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (existing) return;

  const subtotal = Number(md.bs_subtotal_cents ?? 0);
  const shippingCents = Number(md.bs_shipping_cents ?? 0);
  const applicationFee = Number(md.bs_application_fee_cents ?? 0);
  const total = session.amount_total ?? subtotal + shippingCents;
  const fanEmail =
    session.customer_details?.email ?? session.customer_email ?? "";
  const fanName = session.customer_details?.name ?? md.bs_fan_name ?? "";
  // Opt-in marketing coché (ou non) sur la page Stripe Checkout.
  const marketingOptIn = session.consent?.promotions === "opt_in";
  const toJson = (a: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
    a ? (JSON.parse(JSON.stringify(a)) as Prisma.InputJsonValue) : Prisma.JsonNull;
  const shippingAddress = toJson(
    session.shipping_details?.address ?? session.customer_details?.address,
  );
  const billingAddress = toJson(session.customer_details?.address);

  // Charge les variantes pour récupérer les snapshots produit/variante.
  // On inclut `isDigital` + le nombre d'assets pour : (a) ne pas décrémenter
  // de stock sur du digital, (b) émettre les liens de téléchargement.
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: cartLines.map((l) => l.v) } },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          isDigital: true,
          _count: { select: { digitalAssets: true } },
        },
      },
    },
  });
  const linesWithVariant = cartLines
    .map((line) => {
      const v = variants.find((x) => x.id === line.v);
      if (!v) return null;
      return { line, variant: v };
    })
    .filter((x): x is { line: CartLineMeta; variant: (typeof variants)[number] } => x !== null);

  if (linesWithVariant.length === 0) return;

  const shopForArtist = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      ...SHOP_INVOICE_SELECT,
      artist: { select: { email: true, artistName: true } },
    },
  });
  if (!shopForArtist) return;

  // Transaction interactive : décrémentation atomique de chaque variante +
  // émission facture (n° séquentiel + TVA) + création de l'Order. Si une
  // décrémentation échoue (P2025 = stock < qty), tout rollback et on rembourse.
  const issuedAt = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      for (const { line, variant } of linesWithVariant) {
        // Digital : pas de stock à décrémenter (téléchargement illimité).
        if (variant.product.isDigital) continue;
        await tx.productVariant.update({
          // Pré-commande : backorder autorisé (stock négatif), pas de guard.
          where: variant.isPreorder
            ? { id: variant.id }
            : ({
                id: variant.id,
                stock: { gte: line.q },
              } as Prisma.ProductVariantWhereUniqueInput),
          data: { stock: { decrement: line.q } },
        });
      }
      const inv = await issueInvoiceFields(tx, shopForArtist, total, issuedAt);
      await tx.order.create({
        data: {
          publicNumber: generateOrderNumber(),
          shopId,
          fanEmail,
          fanName,
          marketingOptIn,
          shippingAddress,
          billingAddress,
          subtotalCents: subtotal || total - shippingCents,
          shippingCents,
          totalCents: total,
          stripePaymentIntentId: paymentIntentId,
          applicationFeeCents: applicationFee,
          status: "PAID",
          taxCents: inv.taxCents,
          taxRateBps: inv.taxRateBps,
          vatExempt: inv.vatExempt,
          invoiceNumber: inv.invoiceNumber,
          invoicedAt: inv.invoicedAt,
          sellerSnapshot: inv.sellerSnapshot,
          utmSource: md.utm_source || null,
          utmMedium: md.utm_medium || null,
          utmCampaign: md.utm_campaign || null,
          items: {
            create: linesWithVariant.map(({ line, variant }) => ({
              productId: variant.product.id,
              variantId: variant.id,
              titleSnapshot: variant.product.title,
              variantSnapshot:
                [variant.size, variant.color].filter(Boolean).join(" / ") || null,
              unitPriceCents: line.p,
              quantity: line.q,
            })),
          },
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      // Au moins une variante n'avait plus le stock requis. Refund global.
      try {
        const { getStripe } = await import("@/lib/stripe/client");
        await getStripe().refunds.create({
          payment_intent: paymentIntentId,
          refund_application_fee: true,
          reverse_transfer: true,
        });
      } catch {
        // Last resort : log + alerter ops (V1.1).
      }
      return;
    }
    throw e;
  }

  // NB : le compteur d'usages du code promo (`usedCount`) est désormais
  // incrémenté atomiquement à la CRÉATION de la session Stripe
  // (`reserveDiscountUse` dans lib/stripe/checkout-cart.ts), pas ici. Cela
  // ferme la race entre deux checkouts concurrents sur un code à usage
  // limité. On n'incrémente donc plus au webhook pour éviter un double
  // comptage.

  // Side effects : email fan + email artiste + re-sync GMC/Meta des
  // produits dont le stock vient de changer.
  const created = await prisma.order.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { items: true },
  });
  if (!created) return;

  // Délivrance digitale : un grant + lien par produit digital ayant des
  // fichiers. Best-effort (la vente est déjà enregistrée) ; le fan retrouvera
  // aussi ses liens sur son compte.
  const digitalProducts = dedupeDigitalProducts(linesWithVariant);
  let downloads: Awaited<ReturnType<typeof issueDownloadGrants>> = [];
  if (digitalProducts.length > 0) {
    downloads = await issueDownloadGrants({
      orderId: created.id,
      fanEmail: created.fanEmail,
      products: digitalProducts,
    }).catch(() => []);
  }

  await Promise.allSettled([
    sendEmail({
      to: created.fanEmail,
      ...fanOrderConfirmation({
        publicNumber: created.publicNumber,
        fanName: created.fanName,
        fanEmail: created.fanEmail,
        totalCents: created.totalCents,
        subtotalCents: created.subtotalCents,
        shippingCents: created.shippingCents,
        items: created.items.map((i) => ({
          titleSnapshot: i.titleSnapshot,
          variantSnapshot: i.variantSnapshot,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
        })),
        shopDisplayName: shopForArtist.displayName,
        shopContactEmail: shopForArtist.contactEmail,
        invoiceUrl: buildInvoiceUrl(created.id),
        downloads: downloads.map((d) => ({ title: d.title, url: d.url })),
      }),
      replyTo: shopForArtist.contactEmail,
    }),
    sendEmail({
      to: shopForArtist.artist.email,
      ...artistOrderNotification({
        publicNumber: created.publicNumber,
        fanName: created.fanName,
        fanEmail: created.fanEmail,
        totalCents: created.totalCents,
        subtotalCents: created.subtotalCents,
        shippingCents: created.shippingCents,
        items: created.items.map((i) => ({
          titleSnapshot: i.titleSnapshot,
          variantSnapshot: i.variantSnapshot,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
        })),
        shopDisplayName: shopForArtist.displayName,
        shopContactEmail: shopForArtist.contactEmail,
      }),
    }),
    // Re-sync catalogues uniquement pour les produits PHYSIQUES dont le stock
    // a bougé. Les digitaux ne sont pas listés sur GMC/Meta/TikTok Shopping.
    ...Array.from(
      new Set(
        linesWithVariant
          .filter((l) => !l.variant.product.isDigital)
          .map((l) => l.variant.product.id),
      ),
    ).flatMap((productId) => [
      syncProductToGmc(shopId, productId).catch(() => null),
      syncProductToMeta(shopId, productId).catch(() => null),
    ]),
  ]);
}

/**
 * Marque un AbandonedCart comme `recoveredAt` quand le checkout est complété.
 * Évite l'envoi d'une relance après conversion (race avec le cron).
 * Best-effort : si pas de row matching (single-line legacy), on ignore.
 */
async function markAbandonedCartRecovered(
  session: Stripe.Checkout.Session,
): Promise<void> {
  await prisma.abandonedCart
    .updateMany({
      where: { stripeSessionId: session.id, recoveredAt: null },
      data: { recoveredAt: new Date() },
    })
    .catch(() => {});
}

/**
 * Marque un AbandonedCart comme `expiredAt` quand la session Stripe expire
 * (24h par défaut). Au-delà l'URL n'est plus utilisable, donc plus la peine
 * d'envoyer une relance — le cron skip les rows avec expiredAt non null.
 */
async function markAbandonedCartExpired(
  session: Stripe.Checkout.Session,
): Promise<void> {
  await prisma.abandonedCart
    .updateMany({
      where: { stripeSessionId: session.id, expiredAt: null },
      data: { expiredAt: new Date() },
    })
    .catch(() => {});
}
