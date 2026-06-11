import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { sendEmail } from "@/lib/notifications/email";
import { abandonedCartRecoveryEmail } from "@/lib/notifications/abandoned-cart-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron de relance abandon panier.
 *
 * Conditions de sélection :
 *   - createdAt entre H-23h et H-1h (Stripe Checkout expire à H+24h, donc
 *     au-delà de 23h post-création il est trop tard pour réutiliser l'URL ;
 *     en deçà de 1h on laisse au fan le temps de revenir naturellement)
 *   - recoveryEmailSentAt IS NULL (jamais relancé)
 *   - recoveredAt IS NULL (le webhook completed n'a pas fired)
 *   - expiredAt IS NULL (la session n'est pas expirée)
 *
 * Pour chaque ligne : on génère un code promo `-5 %` propre à ce shop
 * (one-shot, valide 48h, minSubtotal = sous-total snapshot pour s'assurer
 * que le code ne s'applique pas à un panier qui aurait été allégé) puis
 * on envoie l'email Resend. Le stamp `recoveryEmailSentAt` empêche le
 * double envoi même si le cron tourne en parallèle (UPDATE...WHERE
 * recoveryEmailSentAt IS NULL agit comme verrou logique).
 *
 * Sécurité : authentifié via `CRON_SECRET`. Accepte deux conventions :
 *   - Vercel Cron : `Authorization: Bearer <CRON_SECRET>`
 *   - Generic : `x-cron-secret: <CRON_SECRET>`
 * Sans secret configuré côté env, la route répond 503 (refus explicite,
 * pas de dégradation silencieuse).
 *
 * Cadence recommandée : toutes les 30 min. Idempotent.
 */
export async function GET(req: NextRequest) {
  return runCron(req);
}

export async function POST(req: NextRequest) {
  return runCron(req);
}

async function runCron(req: NextRequest) {
  const env = getEnv();
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  const headerSecret = req.headers.get("x-cron-secret");
  const auth = req.headers.get("authorization");
  const bearerSecret = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (headerSecret !== env.CRON_SECRET && bearerSecret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const minAge = new Date(now - 1 * 60 * 60 * 1000); // 1h
  const maxAge = new Date(now - 23 * 60 * 60 * 1000); // 23h

  const candidates = await prisma.abandonedCart.findMany({
    where: {
      recoveryEmailSentAt: null,
      recoveredAt: null,
      expiredAt: null,
      createdAt: { lte: minAge, gte: maxAge },
    },
    include: {
      shop: {
        select: {
          id: true,
          displayName: true,
          contactEmail: true,
          artist: { select: { slug: true } },
        },
      },
    },
    take: 100, // batch limit to bound execution time
  });

  let sent = 0;
  let skipped = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const cart of candidates) {
    try {
      const snapshot = cart.cartSnapshot as unknown as CartSnapshot;
      if (!snapshot?.lines || !Array.isArray(snapshot.lines)) {
        skipped++;
        continue;
      }

      // RGPD / L34-5 CPCE : la relance panier avec code promo est de la
      // prospection commerciale — on ne l'envoie qu'aux fans ayant coché
      // l'opt-in marketing lors d'un achat précédent (case Stripe Checkout).
      // Pas d'opt-in connu → on stampe sans envoyer (pas de re-tentative).
      const hasOptIn = await prisma.order.findFirst({
        where: { fanEmail: cart.fanEmail, marketingOptIn: true },
        select: { id: true },
      });
      if (!hasOptIn) {
        await prisma.abandonedCart.updateMany({
          where: { id: cart.id, recoveryEmailSentAt: null },
          data: { recoveryEmailSentAt: new Date() },
        });
        skipped++;
        continue;
      }

      const discountCode = await issueRecoveryDiscountCode({
        shopId: cart.shopId,
        minSubtotalCents: snapshot.subtotalCents,
      });

      // Verrou logique : on stampe recoveryEmailSentAt AVANT l'envoi pour
      // éviter qu'un cron concurrent ne double-relance la même session.
      // Si l'envoi échoue ensuite, le cart est marqué comme relancé sans
      // email — c'est acceptable (échec d'envoi loggé, on ne ré-essaie pas
      // pour ne pas spammer si Resend hoquette).
      const claim = await prisma.abandonedCart.updateMany({
        where: { id: cart.id, recoveryEmailSentAt: null },
        data: {
          recoveryEmailSentAt: new Date(),
          recoveryDiscountCode: discountCode,
        },
      });
      if (claim.count === 0) {
        skipped++;
        continue; // race avec un autre worker
      }

      const email = abandonedCartRecoveryEmail({
        fanName: cart.fanName || cart.fanEmail.split("@")[0],
        shopDisplayName: cart.shop.displayName,
        shopContactEmail: cart.shop.contactEmail,
        resumeUrl: cart.stripeCheckoutUrl,
        discountCode,
        discountPercent: 5,
        lines: snapshot.lines.map((l) => ({
          productTitle: l.productTitle,
          variantLabel: l.variantLabel ?? null,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
        })),
        subtotalCents: snapshot.subtotalCents,
      });

      await sendEmail({
        to: cart.fanEmail,
        replyTo: cart.shop.contactEmail,
        ...email,
      });
      sent++;
    } catch (e) {
      errors.push({
        id: cart.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    candidates: candidates.length,
    sent,
    skipped,
    errors,
  });
}

interface CartSnapshot {
  lines: Array<{
    productTitle: string;
    variantLabel?: string | null;
    quantity: number;
    unitPriceCents: number;
  }>;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  country: string;
}

/**
 * Crée un DiscountCode `-5 %` propre au shop, valide 48h, max 1 utilisation.
 * Le code est aléatoire (10 chars hex upper) pour éviter le squat / sharing.
 */
async function issueRecoveryDiscountCode(input: {
  shopId: string;
  minSubtotalCents: number;
}): Promise<string> {
  const code = `BACK${randomBytes(3).toString("hex").toUpperCase()}`;
  const validUntil = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await prisma.discountCode.create({
    data: {
      shopId: input.shopId,
      code,
      type: "PERCENT",
      value: 5,
      minSubtotalCents: input.minSubtotalCents,
      validUntil,
      maxUses: 1,
      enabled: true,
    },
  });
  return code;
}
