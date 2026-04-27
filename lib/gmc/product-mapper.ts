import type { content_v2_1 } from "googleapis";
import type { Product, ProductImage, ProductVariant } from "@prisma/client";

export interface ShopForGmc {
  contactEmail: string;
}

/**
 * Maps a band.stream product (with its first variant) to a Google Merchant
 * Center "product" resource. We expose one Google entry per variant so taille
 * and couleur appear as proper item-group children.
 */
export function mapProductToGmcEntries(
  product: Product & { variants: ProductVariant[]; images: ProductImage[] },
  artistSlug: string,
): content_v2_1.Schema$Product[] {
  const itemGroupId = product.id;
  return product.variants.map((variant) => {
    const offerId = `${product.id}::${variant.id}`;
    const link = `https://shop.band.stream/${artistSlug}/${product.slug}`;
    const inStock = variant.stock > 0;
    return {
      offerId,
      title: variant.size || variant.color
        ? `${product.title} — ${[variant.size, variant.color].filter(Boolean).join(" / ")}`
        : product.title,
      description: product.longDesc.slice(0, 5000),
      link,
      imageLink: product.images[0]?.url,
      additionalImageLinks: product.images.slice(1, 10).map((i) => i.url),
      contentLanguage: "fr",
      targetCountry: "FR",
      channel: "online",
      availability: inStock ? "in_stock" : "out_of_stock",
      condition: "new",
      brand: product.brand,
      googleProductCategory: product.category,
      itemGroupId,
      sizes: variant.size ? [variant.size] : undefined,
      color: variant.color ?? undefined,
      price: { value: (variant.priceCents / 100).toFixed(2), currency: "EUR" },
      shipping: [
        {
          country: "FR",
          service: "Standard",
          price: { value: "5.90", currency: "EUR" },
        },
      ],
      shippingWeight: { value: product.weightGrams, unit: "g" },
      identifierExists: false,
    };
  });
}

export function offerIdsForProduct(product: { id: string; variants: { id: string }[] }): string[] {
  return product.variants.map((v) => `${product.id}::${v.id}`);
}
