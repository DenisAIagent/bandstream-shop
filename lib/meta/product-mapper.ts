import type { Product, ProductImage, ProductVariant } from "@prisma/client";

export interface MetaCatalogItem {
  id: string;
  retailer_id: string;
  name: string;
  description: string;
  url: string;
  image_url: string;
  additional_image_urls?: string[];
  brand: string;
  price: string;
  currency: "EUR";
  availability: "in stock" | "out of stock";
  condition: "new";
  google_product_category?: string;
  item_group_id: string;
  size?: string;
  color?: string;
}

export function mapProductToMetaItems(
  product: Product & { variants: ProductVariant[]; images: ProductImage[] },
  artistSlug: string,
): MetaCatalogItem[] {
  return product.variants.map((variant) => {
    const retailer_id = `${product.id}::${variant.id}`;
    return {
      id: retailer_id,
      retailer_id,
      name:
        variant.size || variant.color
          ? `${product.title} — ${[variant.size, variant.color].filter(Boolean).join(" / ")}`
          : product.title,
      description: product.longDesc.slice(0, 5000),
      url: `https://shop.band.stream/${artistSlug}/${product.slug}`,
      image_url: product.images[0]?.url ?? "",
      additional_image_urls: product.images.slice(1, 10).map((i) => i.url),
      brand: product.brand,
      price: `${(variant.priceCents / 100).toFixed(2)} EUR`,
      currency: "EUR",
      availability: variant.stock > 0 ? "in stock" : "out of stock",
      condition: "new",
      google_product_category: product.category,
      item_group_id: product.id,
      size: variant.size ?? undefined,
      color: variant.color ?? undefined,
    };
  });
}
