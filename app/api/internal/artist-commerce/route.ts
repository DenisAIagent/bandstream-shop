import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * API interne (machine-à-machine) — statut boutique + chiffre d'affaires d'un
 * artiste, consommée par le CRM pour la fiche client.
 *
 * Jointure inter-app : l'email (règle « 1 personne = 1 email »).
 * Auth : secret partagé `INTERNAL_API_SECRET` via en-tête `x-internal-secret`
 * ou `Authorization: Bearer <secret>`.
 *
 * CA net = Σ (totalCents − refundedAmountCents) des commandes encaissées
 * (PAID / SHIPPED / DELIVERED). Les commandes REFUNDED / CANCELLED sont
 * exclues.
 *
 * Périmètre = TOUTES les boutiques contrôlées par le compte (multi-shops) :
 *   - sa boutique propre (Shop.artistId),
 *   - les boutiques où il est membre (ShopMember, OWNER ou MANAGER),
 *   - s'il possède un Label : les boutiques rattachées à ce label.
 * L'union est dédupliquée. Cas label = somme de toutes ses boutiques.
 */
const COUNTED_STATUSES = ["PAID", "SHIPPED", "DELIVERED"] as const;

function authorize(req: NextRequest, secret: string): boolean {
  const headerSecret = req.headers.get("x-internal-secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return headerSecret === secret || bearer === secret;
}

export async function GET(req: NextRequest) {
  const env = getEnv();
  if (!env.INTERNAL_API_SECRET) {
    return NextResponse.json(
      { error: "INTERNAL_API_SECRET not configured" },
      { status: 503 },
    );
  }
  if (!authorize(req, env.INTERNAL_API_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "email query param required" },
      { status: 400 },
    );
  }

  const artist = await prisma.shopArtist.findUnique({
    where: { email },
    select: {
      id: true,
      status: true,
      shopAddonEnabled: true,
      shop: { select: { id: true } },
      shopMemberships: { select: { shopId: true } },
      ownedLabel: { select: { shops: { select: { id: true } } } },
    },
  });

  if (!artist) {
    return NextResponse.json({ found: false, shop_enabled: false });
  }

  // Union dédupliquée des boutiques contrôlées par le compte.
  const shopIds = new Set<string>();
  if (artist.shop?.id) shopIds.add(artist.shop.id);
  for (const m of artist.shopMemberships) shopIds.add(m.shopId);
  if (artist.ownedLabel) {
    for (const s of artist.ownedLabel.shops) shopIds.add(s.id);
  }

  let revenueCents = 0;
  let ordersCount = 0;
  let currency = "EUR";

  if (shopIds.size > 0) {
    const orders = await prisma.order.findMany({
      where: { shopId: { in: [...shopIds] }, status: { in: [...COUNTED_STATUSES] } },
      select: { totalCents: true, refundedAmountCents: true, currency: true },
    });
    ordersCount = orders.length;
    revenueCents = orders.reduce(
      (sum, o) => sum + o.totalCents - (o.refundedAmountCents ?? 0),
      0,
    );
    if (orders[0]?.currency) currency = orders[0].currency;
  }

  return NextResponse.json({
    found: true,
    shop_enabled: artist.shopAddonEnabled,
    has_shop: shopIds.size > 0,
    shops_count: shopIds.size,
    artist_status: artist.status,
    revenue_total_cents: revenueCents,
    revenue_total_eur: Math.round(revenueCents) / 100,
    orders_count: ordersCount,
    currency,
  });
}
