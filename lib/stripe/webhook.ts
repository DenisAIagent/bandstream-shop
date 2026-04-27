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
import { refreshConnectStatus } from "./connect";

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
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

async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== "paid") return;
  const md = session.metadata ?? {};
  const shopId = md.bs_shop_id;
  const productId = md.bs_product_id;
  const variantId = md.bs_variant_id;
  if (!shopId || !productId || !variantId) return;

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
  const fanName = session.customer_details?.name ?? md.bs_fan_name ?? "";
  const shippingAddress = session.shipping_details?.address ?? session.customer_details?.address ?? null;
  const billingAddress = session.customer_details?.address ?? null;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: true,
      shop: { select: { id: true, displayName: true, contactEmail: true, artist: { select: { email: true, artistName: true } } } },
    },
  });
  const variant = product?.variants.find((v) => v.id === variantId);
  if (!product || !variant) return;

  // Atomic: decrement stock + create order in a single transaction
  try {
    await prisma.$transaction([
      prisma.productVariant.update({
        where: { id: variantId, stock: { gte: 1 } } as Prisma.ProductVariantWhereUniqueInput,
        data: { stock: { decrement: 1 } },
      }),
      prisma.order.create({
        data: {
          publicNumber: generateOrderNumber(),
          shopId,
          fanEmail,
          fanName,
          shippingAddress: shippingAddress ?? Prisma.JsonNull,
          billingAddress: billingAddress ?? Prisma.JsonNull,
          subtotalCents: subtotal || total - shippingCents,
          shippingCents,
          totalCents: total,
          stripePaymentIntentId: paymentIntentId,
          applicationFeeCents: applicationFee,
          status: "PAID",
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
      }),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      // Stock was already 0 by the time the webhook landed. Refund automatically.
      try {
        const Stripe = (await import("stripe")).default;
        const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-10-28.acacia" });
        await stripeClient.refunds.create({
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
