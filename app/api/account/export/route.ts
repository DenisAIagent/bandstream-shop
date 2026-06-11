import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentFan } from "@/lib/fan-auth";

export const dynamic = "force-dynamic";

/**
 * Droit à la portabilité (RGPD art. 20) — export JSON des données du fan,
 * téléchargeable depuis « Mon compte » (session magic-link vérifiée par
 * email, donc l'identité du demandeur est établie).
 */
export async function GET() {
  const fan = await getCurrentFan();
  if (!fan) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { fanEmail: fan.email },
    select: {
      publicNumber: true,
      createdAt: true,
      status: true,
      totalCents: true,
      currency: true,
      shippingAddress: true,
      billingAddress: true,
      carrier: true,
      trackingNumber: true,
      shippedAt: true,
      deliveredAt: true,
      marketingOptIn: true,
      shop: { select: { displayName: true } },
      items: {
        select: { titleSnapshot: true, variantSnapshot: true, quantity: true, unitPriceCents: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const reviews = await prisma.productReview.findMany({
    where: { authorEmail: fan.email },
    select: { authorName: true, rating: true, body: true, createdAt: true, status: true },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    format: "band.stream shop fan export v1 (RGPD art. 20)",
    account: { email: fan.email, name: fan.name, createdAt: fan.createdAt },
    orders,
    reviews,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="bandstream-shop-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
