import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let artist;
  try {
    artist = await requireArtist();
    requirePro(artist);
  } catch {
    redirect("/login?next=/settings");
  }
  const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
  if (!shop) redirect("/shop/activate");

  return (
    <main className="min-h-screen bg-dark-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="font-display text-3xl">Réglages boutique</h1>
          <p className="text-sm text-dark-400">Mode vacances, fermeture définitive, modération.</p>
        </header>

        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href="/settings/shipping" className="rounded-full border border-dark-700 px-4 py-1.5 text-dark-200 hover:border-bs-primary-400">
            Zones de livraison →
          </Link>
          <Link href="/integrations/gmc" className="rounded-full border border-dark-700 px-4 py-1.5 text-dark-200 hover:border-bs-primary-400">
            Google Merchant
          </Link>
          <Link href="/integrations/meta" className="rounded-full border border-dark-700 px-4 py-1.5 text-dark-200 hover:border-bs-primary-400">
            Meta Catalog
          </Link>
        </nav>

        <SettingsForm
          status={artist.status}
          vacationUntil={artist.vacationUntil ? artist.vacationUntil.toISOString().slice(0, 10) : ""}
        />
      </div>
    </main>
  );
}
