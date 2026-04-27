"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { createOnboardingLink, createOrGetConnectAccount, refreshConnectStatus } from "@/lib/stripe/connect";

const createShopSchema = z.object({
  displayName: z.string().min(2).max(80),
  contactEmail: z.string().email(),
  description: z.string().max(500).optional().nullable(),
});

export async function createShopAction(formData: FormData) {
  try {
    const artist = await requireArtist();
    requirePro(artist);
    const parsed = createShopSchema.safeParse({
      displayName: formData.get("displayName"),
      contactEmail: formData.get("contactEmail"),
      description: formData.get("description") || null,
    });
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
    }
    await prisma.shop.upsert({
      where: { artistId: artist.id },
      create: {
        artistId: artist.id,
        displayName: parsed.data.displayName,
        contactEmail: parsed.data.contactEmail,
        description: parsed.data.description ?? undefined,
      },
      update: {
        displayName: parsed.data.displayName,
        contactEmail: parsed.data.contactEmail,
        description: parsed.data.description ?? undefined,
      },
    });
    revalidatePath("/shop/activate");
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function startStripeOnboardingAction() {
  try {
    const artist = await requireArtist();
    requirePro(artist);
    const account = await createOrGetConnectAccount(artist);
    // refresh in case the account was already partially completed
    await refreshConnectStatus(account.stripeAccountId).catch(() => null);
    const url = await createOnboardingLink(account.stripeAccountId);
    return { success: true as const, url };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erreur Stripe" };
  }
}

export async function refreshStripeStatusAction() {
  try {
    const artist = await requireArtist();
    requirePro(artist);
    const account = await prisma.stripeConnectAccount.findUnique({ where: { artistId: artist.id } });
    if (!account) return { success: false as const, error: "Compte Stripe introuvable" };
    const updated = await refreshConnectStatus(account.stripeAccountId);
    revalidatePath("/shop/activate");
    return { success: true as const, kycStatus: updated.kycStatus };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erreur" };
  }
}
