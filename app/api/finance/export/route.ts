import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const artist = await getCurrentArtist();
  if (!artist) return new NextResponse("Unauthorized", { status: 401 });
  try {
    requirePro(artist);
  } catch {
    return new NextResponse("Forbidden — Pro plan required", { status: 403 });
  }
  const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
  if (!shop) return new NextResponse("No shop", { status: 404 });

  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days") ?? 30)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: { shopId: shop.id, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  });

  const header = [
    "order_number",
    "created_at",
    "fan_email",
    "fan_name",
    "currency",
    "subtotal_cents",
    "shipping_cents",
    "total_cents",
    "stripe_fee_cents",
    "application_fee_cents",
    "net_cents",
    "status",
    "carrier",
    "tracking",
    "refunded_cents",
    "utm_source",
    "utm_medium",
    "utm_campaign",
  ];
  const rows = orders.map((o) => {
    const refunded = o.refundedAmountCents ?? 0;
    const stripe = o.stripeFeeCents ?? 0;
    const net = o.totalCents - refunded - stripe - o.applicationFeeCents;
    return [
      o.publicNumber,
      o.createdAt.toISOString(),
      escape(o.fanEmail),
      escape(o.fanName),
      o.currency,
      o.subtotalCents,
      o.shippingCents,
      o.totalCents,
      stripe,
      o.applicationFeeCents,
      net,
      o.status,
      escape(o.carrier ?? ""),
      escape(o.trackingNumber ?? ""),
      refunded,
      escape(o.utmSource ?? ""),
      escape(o.utmMedium ?? ""),
      escape(o.utmCampaign ?? ""),
    ].join(",");
  });
  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bandstream-shop-${shop.id}-${days}d.csv"`,
    },
  });
}

function escape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
