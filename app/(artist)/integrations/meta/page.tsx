import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";

export const dynamic = "force-dynamic";

export default async function MetaIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const sp = await searchParams;
  let artist;
  try {
    artist = await requireArtist();
    requirePro(artist);
  } catch {
    redirect("/login?next=/integrations/meta");
  }
  const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
  if (!shop) redirect("/shop/activate");

  const integration = await prisma.metaIntegration.findUnique({ where: { shopId: shop.id } });

  return (
    <main className="min-h-screen bg-dark-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <p className="text-xs uppercase tracking-widest text-bs-primary-400">Intégration</p>
          <h1 className="mt-1 font-display text-3xl">Meta Catalog</h1>
          <p className="mt-2 text-dark-300">
            Tag tes produits dans Instagram + Facebook Shop, et lance des Advantage+ Catalog ads.
          </p>
        </header>

        {sp.connected && (
          <div className="rounded-xl border border-bs-primary-500/30 bg-bs-primary-500/10 p-4 text-sm text-bs-primary-300">
            ✅ Compte Meta connecté.
          </div>
        )}
        {sp.error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Erreur : {decodeURIComponent(sp.error)}
          </div>
        )}

        {integration ? (
          <div className="rounded-2xl border border-dark-800 bg-dark-900/40 p-6">
            <h2 className="font-display text-xl">Connexion active</h2>
            <p className="mt-2 text-sm text-dark-300">
              Business : <code className="rounded bg-dark-950 px-2 py-0.5 text-bs-primary-300">{integration.businessId}</code>
            </p>
            <p className="text-sm text-dark-300">
              Catalog : <code className="rounded bg-dark-950 px-2 py-0.5 text-bs-primary-300">{integration.catalogId}</code>
            </p>
            <p className="mt-2 text-sm text-dark-400">
              Dernière synchro : {integration.lastSyncAt ? integration.lastSyncAt.toLocaleString("fr-FR") : "jamais"}
            </p>
            {integration.lastError && (
              <p className="mt-2 text-sm text-red-300">Dernière erreur : {integration.lastError}</p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dark-800 bg-dark-900/40 p-6">
            <p className="text-sm text-dark-300">
              Crée ton catalogue dans Meta Business Manager, puis connecte-le ici.
            </p>
            <Link
              href="/api/meta/oauth"
              className="mt-4 inline-flex rounded-full bg-bs-primary-500 px-5 py-2 text-sm font-semibold text-dark-950 hover:bg-bs-primary-400"
            >
              Connecter Meta Business
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
