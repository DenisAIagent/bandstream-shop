import { redirect } from "next/navigation";
import Link from "next/link";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { prisma } from "@/lib/prisma";
import { CreateShopForm, CreateStripeAccountButton, ContinueOnboardingButton } from "./activate-actions";

export const dynamic = "force-dynamic";

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string; refresh?: string }>;
}) {
  const sp = await searchParams;
  let artist;
  try {
    artist = await requireArtist();
    requirePro(artist);
  } catch {
    redirect("/login?next=/shop/activate");
  }

  const stripeAccount = await prisma.stripeConnectAccount.findUnique({
    where: { artistId: artist.id },
  });
  const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });

  return (
    <main className="min-h-screen bg-dark-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl space-y-10">
        <header>
          <p className="text-xs uppercase tracking-widest text-bs-primary-400">Étape 1 sur 3</p>
          <h1 className="mt-2 font-display text-4xl">Activer ta boutique</h1>
          <p className="mt-3 text-dark-300">
            Connecte ton compte Stripe Express pour recevoir les paiements directement. band.stream prélève une commission de 3 % par vente — aucun frais Stripe en plus de ceux de Stripe lui-même.
          </p>
        </header>

        <Step
          number={1}
          title="Identité de la boutique"
          done={!!shop}
        >
          {shop ? (
            <p className="text-sm text-dark-300">Boutique « {shop.displayName} » créée.</p>
          ) : (
            <CreateShopForm artistName={artist.artistName} />
          )}
        </Step>

        <Step
          number={2}
          title="Vérification Stripe (KYC)"
          done={stripeAccount?.kycStatus === "ACTIVE"}
        >
          {!stripeAccount && <CreateStripeAccountButton />}
          {stripeAccount && stripeAccount.kycStatus !== "ACTIVE" && (
            <div className="space-y-3">
              <p className="text-sm text-dark-300">
                Statut actuel : <span className="font-mono text-bs-primary-400">{stripeAccount.kycStatus}</span> · Paiements&nbsp;:{" "}
                {stripeAccount.chargesEnabled ? "✅" : "⏳"} · Virements&nbsp;:{" "}
                {stripeAccount.payoutsEnabled ? "✅" : "⏳"}
              </p>
              <ContinueOnboardingButton />
            </div>
          )}
          {stripeAccount?.kycStatus === "ACTIVE" && (
            <p className="text-sm text-bs-primary-400">✅ Compte vérifié, prêt à encaisser.</p>
          )}
        </Step>

        <Step
          number={3}
          title="Premiers produits"
          done={false}
        >
          <p className="text-sm text-dark-300">Une fois Stripe vérifié, ajoute ton premier produit.</p>
          <Link
            href="/products/new"
            className="mt-3 inline-flex rounded-full bg-green-accent px-4 py-2 text-sm font-semibold text-dark-950 transition hover:bg-green-dark"
          >
            Ajouter un produit
          </Link>
        </Step>

        {sp.return && (
          <div className="rounded-xl border border-bs-primary-500/30 bg-bs-primary-500/10 p-4 text-sm text-bs-primary-300">
            Retour Stripe détecté — on actualise ton statut KYC.
          </div>
        )}
      </div>
    </main>
  );
}

function Step({
  number,
  title,
  done,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-dark-800 bg-dark-900/40 p-6">
      <div className="mb-4 flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm ${
            done ? "bg-bs-primary-500 text-dark-950" : "bg-dark-800 text-dark-300"
          }`}
        >
          {done ? "✓" : number}
        </span>
        <h2 className="font-display text-xl">{title}</h2>
      </div>
      <div className="pl-11">{children}</div>
    </section>
  );
}
