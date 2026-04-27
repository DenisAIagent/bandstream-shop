import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatEur } from "@/lib/pricing/breakdown";
import { ProductPurchase } from "./purchase-form";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ artist: string; product: string }>;
}) {
  const { artist: artistSlug, product: productSlug } = await params;
  const artist = await prisma.shopArtist.findUnique({ where: { slug: artistSlug }, include: { shop: true } });
  if (!artist || !artist.shop) notFound();

  const product = await prisma.product.findFirst({
    where: { shopId: artist.shop.id, slug: productSlug, status: "PUBLISHED" },
    include: { images: { orderBy: { position: "asc" } }, variants: true },
  });
  if (!product) notFound();

  const onVacation = artist.status === "VACATION" && artist.vacationUntil && artist.vacationUntil > new Date();
  const canBuy = !onVacation && artist.status === "ACTIVE";

  return (
    <main className="min-h-screen bg-dark-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-2">
        <Gallery images={product.images.map((i) => i.url)} title={product.title} />
        <div className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-bs-primary-400">{product.brand}</p>
            <h1 className="mt-2 font-display text-4xl leading-tight">{product.title}</h1>
            <p className="mt-3 text-dark-300">{product.shortDesc}</p>
          </div>
          <div className="font-mono text-3xl text-bs-primary-400">{formatEur(product.basePriceCents)}</div>

          {canBuy ? (
            <ProductPurchase
              productId={product.id}
              variants={product.variants.map((v) => ({
                id: v.id,
                sku: v.sku,
                size: v.size,
                color: v.color,
                stock: v.stock,
                priceCents: v.priceCents,
              }))}
              shopSlug={artistSlug}
            />
          ) : (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
              Boutique en pause — les achats sont temporairement désactivés.
            </div>
          )}

          <div className="prose prose-invert max-w-none border-t border-dark-800 pt-6 text-dark-200">
            <h2 className="font-display text-xl text-white">Description</h2>
            <p className="whitespace-pre-line text-dark-300">{product.longDesc}</p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Gallery({ images, title }: { images: string[]; title: string }) {
  if (images.length === 0) {
    return <div className="aspect-square rounded-2xl border border-dark-800 bg-dark-900" />;
  }
  return (
    <div className="space-y-3">
      <img src={images[0]} alt={title} className="aspect-square w-full rounded-2xl border border-dark-800 object-cover" />
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.slice(1, 5).map((url, i) => (
            <img key={i} src={url} alt="" className="aspect-square rounded-lg border border-dark-800 object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}
