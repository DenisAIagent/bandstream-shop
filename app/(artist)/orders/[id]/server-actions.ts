"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { sendEmail } from "@/lib/notifications/email";
import { fanShippedNotification } from "@/lib/notifications/templates";
import { refundOrder } from "@/lib/stripe/refund";

const shipSchema = z.object({
  orderId: z.string().cuid(),
  carrier: z.string().min(1).max(40),
  trackingNumber: z.string().max(120).nullable(),
});

export async function markShippedAction(input: z.infer<typeof shipSchema>) {
  try {
    const artist = await requireArtist();
    requirePro(artist);
    const parsed = shipSchema.parse(input);
    const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
    if (!shop) return { success: false as const, error: "Boutique requise" };
    const order = await prisma.order.findFirst({
      where: { id: parsed.orderId, shopId: shop.id },
      include: { items: true },
    });
    if (!order) return { success: false as const, error: "Commande introuvable" };
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "SHIPPED",
        carrier: parsed.carrier,
        trackingNumber: parsed.trackingNumber,
        shippedAt: new Date(),
      },
    });
    await sendEmail({
      to: order.fanEmail,
      ...fanShippedNotification({
        publicNumber: updated.publicNumber,
        fanName: updated.fanName,
        fanEmail: updated.fanEmail,
        totalCents: updated.totalCents,
        subtotalCents: updated.subtotalCents,
        shippingCents: updated.shippingCents,
        items: order.items.map((i) => ({
          titleSnapshot: i.titleSnapshot,
          variantSnapshot: i.variantSnapshot,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
        })),
        shopDisplayName: shop.displayName,
        shopContactEmail: shop.contactEmail,
        carrier: updated.carrier,
        trackingNumber: updated.trackingNumber,
      }),
      replyTo: shop.contactEmail,
    }).catch(() => null);
    revalidatePath(`/orders/${order.id}`);
    revalidatePath("/orders");
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erreur" };
  }
}

const refundSchema = z.object({
  orderId: z.string().cuid(),
  amountCents: z.number().int().min(50),
});

export async function refundOrderAction(input: z.infer<typeof refundSchema>) {
  try {
    const artist = await requireArtist();
    requirePro(artist);
    const parsed = refundSchema.parse(input);
    const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
    if (!shop) return { success: false as const, error: "Boutique requise" };
    const order = await prisma.order.findFirst({ where: { id: parsed.orderId, shopId: shop.id } });
    if (!order) return { success: false as const, error: "Commande introuvable" };
    if (parsed.amountCents > order.totalCents) {
      return { success: false as const, error: "Montant supérieur au total" };
    }
    await refundOrder({ paymentIntentId: order.stripePaymentIntentId, amountCents: parsed.amountCents });
    revalidatePath(`/orders/${order.id}`);
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erreur" };
  }
}
