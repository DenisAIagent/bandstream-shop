import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { getShopProductById } from "@/lib/products/repository";
import { ProductForm } from "../../_components/ProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let artist;
  try {
    artist = await requireArtist();
    requirePro(artist);
  } catch {
    redirect(`/login?next=/products/${id}/edit`);
  }
  const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
  if (!shop) redirect("/shop/activate");
  const product = await getShopProductById(shop.id, id);
  if (!product) notFound();

  return (
    <main className="min-h-screen bg-dark-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl">Éditer · {product.title}</h1>
        <div className="mt-8">
          <ProductForm
            mode="edit"
            productId={product.id}
            initial={{
              title: product.title,
              shortDesc: product.shortDesc,
              longDesc: product.longDesc,
              category: product.category,
              brand: product.brand,
              basePriceCents: product.basePriceCents,
              weightGrams: product.weightGrams,
              status: product.status,
              variants: product.variants.map((v) => ({
                sku: v.sku,
                size: v.size,
                color: v.color,
                stock: v.stock,
                priceCents: v.priceCents,
              })),
              images: product.images.map((i) => ({
                url: i.url,
                position: i.position,
                isPrimary: i.isPrimary,
              })),
            }}
          />
        </div>
      </div>
    </main>
  );
}
