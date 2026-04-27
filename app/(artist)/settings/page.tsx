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
        <SettingsForm
          status={artist.status}
          vacationUntil={artist.vacationUntil ? artist.vacationUntil.toISOString().slice(0, 10) : ""}
        />
      </div>
    </main>
  );
}
