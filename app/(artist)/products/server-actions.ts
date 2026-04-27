"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import {
  changeStatus,
  createShopProduct,
  productInputSchema,
  updateShopProduct,
  type ProductInput,
} from "@/lib/products/repository";
import { syncProductToGmc, removeProductFromGmc } from "@/lib/gmc/sync";
import { syncProductToMeta, removeProductFromMeta } from "@/lib/meta/sync";

interface SaveArgs {
  mode: "create" | "edit";
  productId?: string;
  input: ProductInput;
}

export async function saveProductAction(args: SaveArgs) {
  try {
    const artist = await requireArtist();
    requirePro(artist);
    const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
    if (!shop) return { success: false as const, error: "Activez votre boutique d'abord" };

    const parsed = productInputSchema.safeParse(args.input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }

    const product =
      args.mode === "create"
        ? await createShopProduct(shop.id, parsed.data)
        : await updateShopProduct(shop.id, args.productId!, parsed.data);

    // Sync external catalogs only when published. Failures don't block the save.
    if (product.status === "PUBLISHED") {
      await Promise.allSettled([
        syncProductToGmc(shop.id, product.id),
        syncProductToMeta(shop.id, product.id),
      ]);
    } else if (product.status === "ARCHIVED") {
      await Promise.allSettled([
        removeProductFromGmc(shop.id, product.id),
        removeProductFromMeta(shop.id, product.id),
      ]);
    }

    revalidatePath("/products");
    return { success: true as const, productId: product.id };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function setProductStatusAction(productId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  try {
    const artist = await requireArtist();
    requirePro(artist);
    const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
    if (!shop) return { success: false as const, error: "Boutique requise" };
    await changeStatus(shop.id, productId, status);
    revalidatePath("/products");
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erreur" };
  }
}
