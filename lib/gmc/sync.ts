import { prisma } from "@/lib/prisma";
import { getContentClient } from "./client";
import { mapProductToGmcEntries, offerIdsForProduct } from "./product-mapper";

/**
 * Push a product to GMC. Idempotent: re-running upserts via offerId.
 * Failures are caught + logged on the integration row but never throw upward —
 * a failing GMC sync must NOT block a shop sale.
 */
export async function syncProductToGmc(shopId: string, productId: string): Promise<void> {
  const integration = await prisma.gmcIntegration.findUnique({ where: { shopId } });
  if (!integration || integration.status !== "ACTIVE") return;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: true,
      images: { orderBy: { position: "asc" } },
      shop: { include: { artist: { select: { slug: true } } } },
    },
  });
  if (!product) return;

  try {
    const content = await getContentClient(shopId);
    const entries = mapProductToGmcEntries(product, product.shop.artist.slug);
    for (const entry of entries) {
      await content.products.insert({
        merchantId: integration.merchantId,
        requestBody: entry,
      });
    }
    await prisma.gmcIntegration.update({
      where: { shopId },
      data: { lastSyncAt: new Date(), lastError: null, status: "ACTIVE" },
    });
  } catch (e) {
    await prisma.gmcIntegration.update({
      where: { shopId },
      data: { lastError: e instanceof Error ? e.message : "GMC sync error", status: "ERROR" },
    });
  }
}

export async function removeProductFromGmc(shopId: string, productId: string): Promise<void> {
  const integration = await prisma.gmcIntegration.findUnique({ where: { shopId } });
  if (!integration || integration.status !== "ACTIVE") return;
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: { select: { id: true } } },
  });
  if (!product) return;
  try {
    const content = await getContentClient(shopId);
    for (const offerId of offerIdsForProduct(product)) {
      await content.products.delete({
        merchantId: integration.merchantId,
        productId: `online:fr:FR:${offerId}`,
      });
    }
  } catch {
    // tolerated: maybe product never existed there
  }
}
