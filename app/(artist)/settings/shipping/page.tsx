import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { ShippingZonesEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function ShippingZonesPage() {
  let artist;
  try {
    artist = await requireArtist();
    requirePro(artist);
  } catch {
    redirect("/login?next=/settings/shipping");
  }
  const shop = await prisma.shop.findUnique({
    where: { artistId: artist.id },
    include: { shippingZones: { orderBy: { name: "asc" } } },
  });
  if (!shop) redirect("/shop/activate");

  return (
    <main className="min-h-screen bg-dark-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <p className="text-xs uppercase tracking-widest text-bs-primary-400">Réglages</p>
          <h1 className="font-display text-3xl">Zones de livraison</h1>
          <p className="mt-2 text-sm text-dark-300">
            Sans au moins une zone active couvrant le pays du fan, le checkout échoue. Quatre zones par défaut sont créées à l'activation : France métro, UE, UK/CH/NO, US/CA.
          </p>
        </header>

        <ShippingZonesEditor
          zones={shop.shippingZones.map((z) => ({
            id: z.id,
            name: z.name,
            countries: z.countries,
            flatRateCents: z.flatRateCents,
            freeAboveCents: z.freeAboveCents,
            estimatedDays: z.estimatedDays,
            carrier: z.carrier,
            enabled: z.enabled,
          }))}
        />
      </div>
    </main>
  );
}
