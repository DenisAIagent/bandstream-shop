import { prisma } from "@/lib/prisma";
import { getDecryptedToken, metaGraphFetch } from "./client";
import { mapProductToMetaItems } from "./product-mapper";

export async function syncProductToMeta(shopId: string, productId: string): Promise<void> {
  const integration = await prisma.metaIntegration.findUnique({ where: { shopId } });
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
    const { token, catalogId } = await getDecryptedToken(shopId);
    const items = mapProductToMetaItems(product, product.shop.artist.slug);
    const requests = items.map((item) => ({
      method: "UPDATE",
      retailer_id: item.retailer_id,
      data: item,
    }));
    await metaGraphFetch(`/${catalogId}/items_batch`, {
      method: "POST",
      token,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requests, item_type: "PRODUCT_ITEM" }),
    });
    await prisma.metaIntegration.update({
      where: { shopId },
      data: { lastSyncAt: new Date(), lastError: null, status: "ACTIVE" },
    });
  } catch (e) {
    await prisma.metaIntegration.update({
      where: { shopId },
      data: { lastError: e instanceof Error ? e.message : "Meta sync error", status: "ERROR" },
    });
  }
}

export async function removeProductFromMeta(shopId: string, productId: string): Promise<void> {
  const integration = await prisma.metaIntegration.findUnique({ where: { shopId } });
  if (!integration || integration.status !== "ACTIVE") return;
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: { select: { id: true } } },
  });
  if (!product) return;
  try {
    const { token, catalogId } = await getDecryptedToken(shopId);
    const requests = product.variants.map((v) => ({
      method: "DELETE",
      retailer_id: `${product.id}::${v.id}`,
    }));
    await metaGraphFetch(`/${catalogId}/items_batch`, {
      method: "POST",
      token,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requests, item_type: "PRODUCT_ITEM" }),
    });
  } catch {
    // tolerated
  }
}
