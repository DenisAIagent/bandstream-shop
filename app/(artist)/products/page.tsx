import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { listShopProducts } from "@/lib/products/repository";
import { formatEur } from "@/lib/pricing/breakdown";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  let artist;
  try {
    artist = await requireArtist();
    requirePro(artist);
  } catch {
    redirect("/login?next=/products");
  }
  const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
  if (!shop) redirect("/shop/activate");

  const products = await listShopProducts(shop.id);

  return (
    <main className="min-h-screen bg-dark-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl">Produits</h1>
            <p className="text-sm text-dark-400">{products.length} produit(s) — boutique {shop.displayName}</p>
          </div>
          <Link
            href="/products/new"
            className="rounded-full bg-green-accent px-5 py-2.5 text-sm font-semibold text-dark-950 transition hover:bg-green-dark"
          >
            + Nouveau produit
          </Link>
        </header>

        {products.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-dark-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-dark-900 text-xs uppercase tracking-wider text-dark-400">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Stock total</th>
                  <th className="px-4 py-3">Prix</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0);
                  const primaryImage = p.images.find((i) => i.isPrimary) ?? p.images[0];
                  return (
                    <tr key={p.id} className="border-t border-dark-800 hover:bg-dark-900/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {primaryImage && (
                            <img src={primaryImage.url} alt="" className="h-10 w-10 rounded-md border border-dark-800 object-cover" />
                          )}
                          <div>
                            <div className="font-medium text-white">{p.title}</div>
                            <div className="text-xs text-dark-400">{p.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 font-mono">{totalStock}</td>
                      <td className="px-4 py-3 font-mono">{formatEur(p.basePriceCents)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/products/${p.id}/edit`} className="text-bs-primary-400 hover:underline">
                          Éditer
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-dark-700 p-12 text-center">
      <h2 className="font-display text-xl">Pas encore de produit</h2>
      <p className="mt-2 text-sm text-dark-400">Ajoute ton premier vinyle, T-shirt ou accessoire.</p>
      <Link
        href="/products/new"
        className="mt-6 inline-flex rounded-full bg-green-accent px-5 py-2.5 text-sm font-semibold text-dark-950 hover:bg-green-dark"
      >
        Créer un produit
      </Link>
    </div>
  );
}

function StatusBadge({ status }: { status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  const map = {
    DRAFT: { label: "Brouillon", className: "bg-dark-800 text-dark-300" },
    PUBLISHED: { label: "En ligne", className: "bg-bs-primary-500/20 text-bs-primary-300" },
    ARCHIVED: { label: "Archivé", className: "bg-amber-500/10 text-amber-300" },
  };
  const meta = map[status];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>{meta.label}</span>;
}
