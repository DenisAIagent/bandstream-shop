import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";
import { getCurrentArtist } from "@/lib/auth";
import { resolveCurrentShop } from "@/lib/shop/current-shop";
import {
  getShopCustomers,
  type CustomerSegment,
} from "@/lib/crm/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEGMENTS: CustomerSegment[] = [
  "ALL",
  "REPEAT",
  "VIP",
  "RECENT",
  "LAPSED",
];

/**
 * Export de l'audience d'une boutique.
 *
 *   ?format=plain  (défaut) → CSV CRM complet (email, nom, métriques).
 *   ?format=hashed          → email SHA-256 (normalisé), prêt pour Google
 *                             Customer Match / Meta Custom Audiences.
 *   ?segment=REPEAT|VIP|...  → filtre sur un segment.
 *
 * RGPD : l'artiste/label est responsable de traitement. L'export hashé ne
 * contient que des empreintes d'emails de SES clients, pour réactiver une
 * relation commerciale existante (base : intérêt légitime / exécution du
 * contrat). À n'importer que dans des audiences conformes.
 */
export async function GET(req: NextRequest) {
  const artist = await getCurrentArtist();
  if (!artist) return new NextResponse("Unauthorized", { status: 401 });

  const shop = await resolveCurrentShop(artist.id);
  if (!shop) return new NextResponse("No shop", { status: 404 });

  const segParam = (req.nextUrl.searchParams.get("segment") ?? "ALL").toUpperCase();
  const segment = (SEGMENTS as string[]).includes(segParam)
    ? (segParam as CustomerSegment)
    : "ALL";
  const format =
    req.nextUrl.searchParams.get("format") === "hashed" ? "hashed" : "plain";

  const customers = await getShopCustomers(shop.id, { segment });

  let csv: string;
  if (format === "hashed") {
    // Format audience : une colonne d'emails SHA-256 (normalisés : trim +
    // minuscule), c'est l'entrée attendue par Customer Match / Custom Audiences.
    // RGPD : seuls les clients ayant coché l'opt-in marketing au checkout
    // (Order.marketingOptIn) peuvent être réutilisés en audience publicitaire.
    const optedIn = await prisma.order.findMany({
      where: { shopId: shop.id, marketingOptIn: true },
      select: { fanEmail: true },
      distinct: ["fanEmail"],
    });
    const optedInSet = new Set(optedIn.map((o) => o.fanEmail.trim().toLowerCase()));
    const rows = customers
      .filter((c) => optedInSet.has(c.email.trim().toLowerCase()))
      .map((c) => sha256Email(c.email));
    csv = ["email", ...rows].join("\n");
  } else {
    const header = [
      "email",
      "name",
      "orders",
      "total_spent_cents",
      "aov_cents",
      "first_order",
      "last_order",
      "segments",
    ];
    const rows = customers.map((c) =>
      [
        esc(c.email),
        esc(c.name ?? ""),
        c.ordersCount,
        c.totalSpentCents,
        c.aovCents,
        c.firstOrderAt.toISOString(),
        c.lastOrderAt.toISOString(),
        esc(c.segments.join("|")),
      ].join(","),
    );
    csv = [header.join(","), ...rows].join("\n");
  }

  const suffix = format === "hashed" ? "audience-hashed" : "clients";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bandstream-${suffix}-${segment.toLowerCase()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Email normalisé (trim + minuscule) puis SHA-256 hex. */
function sha256Email(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
}

/** Échappe une valeur CSV + neutralise l'injection de formule. */
function esc(v: string): string {
  let safe = v;
  if (/^[=+\-@\t\r]/.test(safe)) safe = `'${safe}`;
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
