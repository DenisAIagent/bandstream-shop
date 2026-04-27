import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { moderateProduct } from "@/lib/moderation/rules";
import type { Product, ProductImage, ProductStatus, ProductVariant } from "@prisma/client";

export const productInputSchema = z.object({
  title: z.string().min(2).max(120),
  shortDesc: z.string().min(2).max(280),
  longDesc: z.string().min(2).max(5000),
  category: z.string().min(2).max(120),
  brand: z.string().min(1).max(80),
  basePriceCents: z.number().int().min(100).max(100_000_00),
  weightGrams: z.number().int().min(1).max(50_000),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  variants: z
    .array(
      z.object({
        sku: z.string().min(1).max(64),
        size: z.string().max(40).nullable().optional(),
        color: z.string().max(40).nullable().optional(),
        stock: z.number().int().min(0).max(100_000),
        priceCents: z.number().int().min(100).max(100_000_00),
      }),
    )
    .min(1, "Au moins une variante requise")
    .max(40),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        position: z.number().int().min(0).max(50).default(0),
        isPrimary: z.boolean().default(false),
      }),
    )
    .min(1, "Au moins une image requise")
    .max(8),
});

export type ProductInput = z.infer<typeof productInputSchema>;

export type ProductWithRelations = Product & {
  variants: ProductVariant[];
  images: ProductImage[];
};

export async function listShopProducts(shopId: string): Promise<ProductWithRelations[]> {
  return prisma.product.findMany({
    where: { shopId },
    include: { variants: true, images: { orderBy: { position: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getShopProductById(shopId: string, id: string): Promise<ProductWithRelations | null> {
  return prisma.product.findFirst({
    where: { id, shopId },
    include: { variants: true, images: { orderBy: { position: "asc" } } },
  });
}

export async function createShopProduct(shopId: string, input: ProductInput): Promise<ProductWithRelations> {
  moderateProduct({ title: input.title, longDesc: input.longDesc, basePriceCents: input.basePriceCents });
  const slug = await uniqueSlug(shopId, slugify(input.title));
  return prisma.product.create({
    data: {
      shopId,
      slug,
      title: input.title,
      shortDesc: input.shortDesc,
      longDesc: input.longDesc,
      category: input.category,
      brand: input.brand,
      basePriceCents: input.basePriceCents,
      weightGrams: input.weightGrams,
      status: input.status,
      variants: { create: input.variants.map((v) => ({ ...v, size: v.size ?? null, color: v.color ?? null })) },
      images: {
        create: input.images.map((img, i) => ({
          url: img.url,
          position: img.position ?? i,
          isPrimary: img.isPrimary || i === 0,
        })),
      },
    },
    include: { variants: true, images: { orderBy: { position: "asc" } } },
  });
}

export async function updateShopProduct(
  shopId: string,
  productId: string,
  input: ProductInput,
): Promise<ProductWithRelations> {
  moderateProduct({ title: input.title, longDesc: input.longDesc, basePriceCents: input.basePriceCents });
  await prisma.$transaction([
    prisma.productVariant.deleteMany({ where: { productId } }),
    prisma.productImage.deleteMany({ where: { productId } }),
    prisma.product.update({
      where: { id: productId, shopId },
      data: {
        title: input.title,
        shortDesc: input.shortDesc,
        longDesc: input.longDesc,
        category: input.category,
        brand: input.brand,
        basePriceCents: input.basePriceCents,
        weightGrams: input.weightGrams,
        status: input.status,
        variants: { create: input.variants.map((v) => ({ ...v, size: v.size ?? null, color: v.color ?? null })) },
        images: {
          create: input.images.map((img, i) => ({
            url: img.url,
            position: img.position ?? i,
            isPrimary: img.isPrimary || i === 0,
          })),
        },
      },
    }),
  ]);
  const refreshed = await getShopProductById(shopId, productId);
  if (!refreshed) throw new Error("Product disappeared after update");
  return refreshed;
}

export async function changeStatus(shopId: string, productId: string, status: ProductStatus): Promise<void> {
  await prisma.product.update({ where: { id: productId, shopId }, data: { status } });
}

async function uniqueSlug(shopId: string, base: string): Promise<string> {
  const seed = base || "produit";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? seed : `${seed}-${i + 1}`;
    const exists = await prisma.product.findFirst({ where: { shopId, slug: candidate } });
    if (!exists) return candidate;
  }
  return `${seed}-${Date.now()}`;
}
