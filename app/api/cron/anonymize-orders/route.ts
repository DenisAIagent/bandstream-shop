import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Purge de rétention RGPD (art. 5.1.e) — anonymisation des commandes
 * anciennes.
 *
 * Les données identifiantes (email, nom, adresses) d'une commande n'ont
 * plus de finalité au-delà de la garantie légale de conformité (2 ans) —
 * on retient 3 ans par prudence (litiges). Au-delà : email/nom/adresses
 * écrasés, opt-in remis à false, montants et identifiants Stripe conservés
 * (obligations comptables, art. 17.3.b). Les DownloadGrants et paniers
 * abandonnés liés à ces emails expirés sont également purgés.
 *
 * Auth (même convention que les autres crons) :
 *   - Vercel Cron : `Authorization: Bearer <CRON_SECRET>`
 *   - Generic : `x-cron-secret: <CRON_SECRET>`
 * Cadence recommandée : hebdomadaire. Idempotent.
 */
const RETENTION_YEARS = 3;
const ANON_EMAIL_DOMAIN = "rgpd.invalid";

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

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);

  // Commandes anciennes encore identifiantes (batch borné).
  const stale = await prisma.order.findMany({
    where: {
      createdAt: { lt: cutoff },
      NOT: { fanEmail: { endsWith: `@${ANON_EMAIL_DOMAIN}` } },
    },
    select: { id: true, fanEmail: true },
    take: 500,
  });

  let anonymized = 0;
  for (const order of stale) {
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          fanEmail: `anonyme-${order.id.slice(0, 8)}@${ANON_EMAIL_DOMAIN}`,
          fanName: "Acheteur anonymisé",
          shippingAddress: Prisma.JsonNull,
          billingAddress: Prisma.JsonNull,
          marketingOptIn: false,
        },
      }),
      prisma.downloadGrant.deleteMany({
        where: { orderId: order.id },
      }),
      prisma.abandonedCart.deleteMany({
        where: { fanEmail: order.fanEmail, createdAt: { lt: cutoff } },
      }),
    ]);
    anonymized++;
  }

  // Sessions fan expirées + compteurs de rate-limit périmés (IP/emails).
  const sessions = await prisma.fanSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  const rateLimits = await prisma.rateLimitCounter.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  return NextResponse.json({
    anonymized,
    expiredFanSessions: sessions.count,
    expiredRateLimits: rateLimits.count,
    cutoff: cutoff.toISOString(),
  });
}
