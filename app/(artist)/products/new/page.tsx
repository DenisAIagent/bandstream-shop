import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { ProductForm } from "../_components/ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  let artist;
  try {
    artist = await requireArtist();
    requirePro(artist);
  } catch {
    redirect("/login?next=/products/new");
  }
  const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
  if (!shop) redirect("/shop/activate");

  return (
    <main className="min-h-screen bg-dark-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl">Nouveau produit</h1>
        <p className="mt-2 text-sm text-dark-400">Renseigne les informations, variantes et images. Tu pourras éditer ensuite.</p>
        <div className="mt-8">
          <ProductForm mode="create" />
        </div>
      </div>
    </main>
  );
}
