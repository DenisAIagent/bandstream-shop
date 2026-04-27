import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { formatEur } from "@/lib/pricing/breakdown";

export const dynamic = "force-dynamic";

function urgencyBucket(createdAt: Date, status: string): { label: string; cx: string } {
  if (status !== "PAID") return { label: status, cx: "bg-dark-800 text-dark-300" };
  const ageHours = (Date.now() - createdAt.getTime()) / 3_600_000;
  if (ageHours > 48) return { label: "🔴 > 48 h", cx: "bg-red-500/15 text-red-300" };
  if (ageHours > 24) return { label: "🟡 24–48 h", cx: "bg-amber-500/15 text-amber-300" };
  return { label: "🟢 < 24 h", cx: "bg-bs-primary-500/15 text-bs-primary-300" };
}

export default async function OrdersPage() {
  let artist;
  try {
    artist = await requireArtist();
    requirePro(artist);
  } catch {
    redirect("/login?next=/orders");
  }
  const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
  if (!shop) redirect("/shop/activate");

  const orders = await prisma.order.findMany({
    where: { shopId: shop.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { items: true },
    take: 100,
  });

  return (
    <main className="min-h-screen bg-dark-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-display text-3xl">Commandes</h1>
        <p className="text-sm text-dark-400">{orders.length} commande(s)</p>
        <div className="mt-8 overflow-hidden rounded-2xl border border-dark-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-dark-900 text-xs uppercase tracking-wider text-dark-400">
              <tr>
                <th className="px-4 py-3">N°</th>
                <th className="px-4 py-3">Fan</th>
                <th className="px-4 py-3">Articles</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Urgence</th>
                <th className="px-4 py-3 text-right">—</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const u = urgencyBucket(o.createdAt, o.status);
                return (
                  <tr key={o.id} className="border-t border-dark-800 hover:bg-dark-900/40">
                    <td className="px-4 py-3 font-mono text-bs-primary-300">{o.publicNumber}</td>
                    <td className="px-4 py-3">
                      <div>{o.fanName}</div>
                      <div className="text-xs text-dark-400">{o.fanEmail}</div>
                    </td>
                    <td className="px-4 py-3">{o.items.length}</td>
                    <td className="px-4 py-3 font-mono">{formatEur(o.totalCents)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${u.cx}`}>
                        {u.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/orders/${o.id}`} className="text-bs-primary-400 hover:underline">
                        Détails
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-dark-500">
                    Aucune commande pour l'instant. Partage ta vitrine.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
