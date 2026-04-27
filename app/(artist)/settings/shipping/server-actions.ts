"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";

const zoneInputSchema = z.object({
  name: z.string().min(2).max(40),
  countries: z.array(z.string().length(2)).min(1, "Au moins un pays"),
  flatRateCents: z.number().int().min(0).max(100_000),
  freeAboveCents: z.number().int().min(0).max(1_000_000).nullable(),
  estimatedDays: z.number().int().min(1).max(60),
  carrier: z.string().min(1).max(40),
  enabled: z.boolean().default(true),
});

async function getOwnedShop(artistId: string) {
  const shop = await prisma.shop.findUnique({ where: { artistId } });
  if (!shop) throw new Error("Boutique introuvable");
  return shop;
}

export async function saveShippingZoneAction(input: z.infer<typeof zoneInputSchema> & { id: string }) {
  try {
    const artist = await requireArtist();
    requirePro(artist);
    const shop = await getOwnedShop(artist.id);
    const parsed = zoneInputSchema.parse(input);
    const existing = await prisma.shippingZone.findFirst({ where: { id: input.id, shopId: shop.id } });
    if (!existing) return { success: false as const, error: "Zone introuvable" };
    await prisma.shippingZone.update({ where: { id: input.id }, data: parsed });
    revalidatePath("/settings/shipping");
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function deleteShippingZoneAction({ id }: { id: string }) {
  try {
    const artist = await requireArtist();
    requirePro(artist);
    const shop = await getOwnedShop(artist.id);
    await prisma.shippingZone.deleteMany({ where: { id, shopId: shop.id } });
    revalidatePath("/settings/shipping");
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function addShippingZoneAction(input: z.infer<typeof zoneInputSchema>) {
  try {
    const artist = await requireArtist();
    requirePro(artist);
    const shop = await getOwnedShop(artist.id);
    // Allow draft zone with empty countries — user fills in inline editor.
    const safe = { ...input, countries: input.countries.length ? input.countries : ["XX"] };
    await prisma.shippingZone.create({
      data: { ...safe, shopId: shop.id },
    });
    revalidatePath("/settings/shipping");
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erreur" };
  }
}
