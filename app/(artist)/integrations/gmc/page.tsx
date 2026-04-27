import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { GmcConnectForm } from "./form";

export const dynamic = "force-dynamic";

export default async function GmcIntegrationPage({
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
    redirect("/login?next=/integrations/gmc");
  }
  const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
  if (!shop) redirect("/shop/activate");

  const integration = await prisma.gmcIntegration.findUnique({ where: { shopId: shop.id } });

  return (
    <main className="min-h-screen bg-dark-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <p className="text-xs uppercase tracking-widest text-bs-primary-400">Intégration</p>
          <h1 className="mt-1 font-display text-3xl">Google Merchant Center</h1>
          <p className="mt-2 text-dark-300">
            Pousse automatiquement ton catalogue vers Google Shopping et active Performance Max.
          </p>
        </header>

        {sp.connected && (
          <div className="rounded-xl border border-bs-primary-500/30 bg-bs-primary-500/10 p-4 text-sm text-bs-primary-300">
            ✅ Compte GMC connecté. Tes prochains produits publiés seront synchronisés.
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
              Merchant ID : <code className="rounded bg-dark-950 px-2 py-0.5 text-bs-primary-300">{integration.merchantId}</code>
            </p>
            <p className="text-sm text-dark-400">
              Dernière synchro :{" "}
              {integration.lastSyncAt ? integration.lastSyncAt.toLocaleString("fr-FR") : "jamais"}
            </p>
            {integration.lastError && (
              <p className="mt-2 text-sm text-red-300">Dernière erreur : {integration.lastError}</p>
            )}
          </div>
        ) : (
          <GmcConnectForm />
        )}

        <div className="rounded-2xl border border-dark-800 bg-dark-900/40 p-6 text-sm text-dark-400">
          <h3 className="font-display text-base text-white">Comment ça marche</h3>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>Crée (ou ouvre) ton compte Google Merchant Center et récupère ton <em>Merchant ID</em>.</li>
            <li>Clique sur « Connecter Google » ci-dessous, et autorise band.stream.</li>
            <li>Renseigne ton Merchant ID dans l'écran retour Google.</li>
            <li>Tes produits publiés seront synchronisés sous 5 minutes à 24 h.</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
