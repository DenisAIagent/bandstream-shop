import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatEur } from "@/lib/pricing/breakdown";

export const dynamic = "force-dynamic";

export default async function ArtistShopPage({ params }: { params: Promise<{ artist: string }> }) {
  const { artist: slug } = await params;
  const artist = await prisma.shopArtist.findUnique({
    where: { slug },
    include: {
      shop: { include: { products: { where: { status: "PUBLISHED" }, include: { images: true, variants: true } } } },
    },
  });
  if (!artist || !artist.shop) notFound();
  if (artist.status === "SUSPENDED" || artist.status === "CLOSED") {
    return (
      <main className="grid min-h-screen place-items-center bg-dark-950 text-white">
        <p className="text-center text-dark-300">Cette boutique est actuellement fermée.</p>
      </main>
    );
  }

  const onVacation =
    artist.status === "VACATION" && artist.vacationUntil && artist.vacationUntil > new Date();

  return (
    <main className="min-h-screen bg-dark-950 text-white">
      <header className="border-b border-dark-900 bg-dark-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-bs-primary-400">band.stream · shop</p>
            <h1 className="font-display text-3xl">{artist.shop.displayName}</h1>
          </div>
          {artist.shop.logoUrl && (
            <img src={artist.shop.logoUrl} alt={artist.shop.displayName} className="h-12 w-12 rounded-full border border-dark-800 object-cover" />
          )}
        </div>
      </header>

      {onVacation && (
        <div className="mx-auto mt-6 max-w-6xl rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Boutique en pause jusqu'au {artist.vacationUntil!.toLocaleDateString("fr-FR")}. Aucune nouvelle commande pour l'instant.
        </div>
      )}

      <section className="mx-auto max-w-6xl px-6 py-10">
        {artist.shop.description && (
          <p className="mb-10 max-w-2xl text-dark-300">{artist.shop.description}</p>
        )}
        {artist.shop.products.length === 0 ? (
          <p className="text-center text-dark-400">Aucun produit pour le moment.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {artist.shop.products.map((p) => {
              const img = p.images.find((i) => i.isPrimary) ?? p.images[0];
              const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
              return (
                <Link
                  key={p.id}
                  href={`/${slug}/${p.slug}`}
                  className="group overflow-hidden rounded-2xl border border-dark-800 bg-dark-900/40 transition hover:-translate-y-1 hover:border-bs-primary-500/50"
                >
                  {img && <img src={img.url} alt={p.title} className="aspect-square w-full object-cover" />}
                  <div className="p-4">
                    <div className="font-display text-lg">{p.title}</div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="font-mono text-bs-primary-400">{formatEur(p.basePriceCents)}</span>
                      {totalStock === 0 && <span className="text-xs text-amber-300">Rupture</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-dark-900 px-6 py-8 text-center text-xs text-dark-500">
        Boutique propulsée par <Link href="/" className="text-bs-primary-400 hover:underline">band.stream</Link> · contact vendeur : {artist.shop.contactEmail}
        <div className="mt-2">
          BANDSTREAM SAS · SIREN 939 221 438 ·{" "}
          <Link href="/legal/mentions-legales" className="hover:text-bs-primary-400">Mentions légales</Link>
        </div>
      </footer>
    </main>
  );
}
