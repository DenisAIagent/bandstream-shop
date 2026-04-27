"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireArtist, destroySession } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";

export async function setVacationAction(input: { until: string }) {
  try {
    const artist = await requireArtist();
    requirePro(artist);
    const parsed = z.object({ until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input);
    const until = new Date(`${parsed.until}T23:59:59Z`);
    if (until < new Date()) return { success: false as const, error: "La date doit être future" };
    await prisma.shopArtist.update({
      where: { id: artist.id },
      data: { status: "VACATION", vacationUntil: until },
    });
    revalidatePath("/settings");
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function reopenShopAction() {
  try {
    const artist = await requireArtist();
    requirePro(artist);
    await prisma.shopArtist.update({
      where: { id: artist.id },
      data: { status: "ACTIVE", vacationUntil: null },
    });
    revalidatePath("/settings");
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function closeShopAction() {
  try {
    const artist = await requireArtist();
    requirePro(artist);
    const open = await prisma.order.count({ where: { shop: { artistId: artist.id }, status: "PAID" } });
    if (open > 0) {
      return {
        success: false as const,
        error: `Impossible : ${open} commande(s) à expédier ou rembourser avant fermeture.`,
      };
    }
    await prisma.shopArtist.update({
      where: { id: artist.id },
      data: { status: "CLOSED" },
    });
    await destroySession();
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erreur" };
  }
}
