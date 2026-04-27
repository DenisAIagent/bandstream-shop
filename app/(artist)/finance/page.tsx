import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { formatEur } from "@/lib/pricing/breakdown";

export const dynamic = "force-dynamic";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  let artist;
  try {
    artist = await requireArtist();
    requirePro(artist);
  } catch {
    redirect("/login?next=/finance");
  }
  const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
  if (!shop) redirect("/shop/activate");

  const days = Math.max(1, Math.min(365, Number(sp.days ?? 30)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: { shopId: shop.id, createdAt: { gte: since } },
    select: {
      id: true,
      publicNumber: true,
      createdAt: true,
      totalCents: true,
      subtotalCents: true,
      shippingCents: true,
      applicationFeeCents: true,
      stripeFeeCents: true,
      status: true,
      refundedAmountCents: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const totals = orders.reduce(
    (acc, o) => {
      const refunded = o.refundedAmountCents ?? 0;
      const grossNet = o.totalCents - refunded;
      acc.gross += grossNet;
      acc.stripe += o.stripeFeeCents ?? 0;
      acc.commission += o.applicationFeeCents;
      return acc;
    },
    { gross: 0, stripe: 0, commission: 0 },
  );
  const net = totals.gross - totals.stripe - totals.commission;

  return (
    <main className="min-h-screen bg-dark-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="font-display text-3xl">Finance</h1>
            <p className="text-sm text-dark-400">Période : {days} derniers jours</p>
          </div>
          <div className="flex items-center gap-2">
            <RangeLink current={days} value={7} />
            <RangeLink current={days} value={30} />
            <RangeLink current={days} value={90} />
            <RangeLink current={days} value={365} />
            <Link
              href={`/api/finance/export?days=${days}`}
              className="rounded-full border border-dark-700 px-4 py-1.5 text-sm text-dark-300 hover:border-bs-primary-400"
            >
              Export CSV
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metric label="CA brut" value={formatEur(totals.gross)} />
          <Metric label="Frais Stripe" value={`-${formatEur(totals.stripe)}`} subtle />
          <Metric label="Commission band.stream" value={`-${formatEur(totals.commission)}`} subtle />
          <Metric label="Net reçu" value={formatEur(net)} highlight />
        </section>

        <section className="rounded-2xl border border-dark-800 bg-dark-900/40 p-5">
          <h2 className="mb-3 font-display text-lg">Détail commandes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-dark-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">N°</th>
                  <th className="px-3 py-2">Brut</th>
                  <th className="px-3 py-2">Stripe</th>
                  <th className="px-3 py-2">Commission</th>
                  <th className="px-3 py-2">Net</th>
                  <th className="px-3 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const refunded = o.refundedAmountCents ?? 0;
                  const grossNet = o.totalCents - refunded;
                  const stripe = o.stripeFeeCents ?? 0;
                  const net = grossNet - stripe - o.applicationFeeCents;
                  return (
                    <tr key={o.id} className="border-t border-dark-800">
                      <td className="px-3 py-2 text-dark-400">{o.createdAt.toLocaleDateString("fr-FR")}</td>
                      <td className="px-3 py-2 font-mono text-bs-primary-300">{o.publicNumber}</td>
                      <td className="px-3 py-2 font-mono">{formatEur(grossNet)}</td>
                      <td className="px-3 py-2 font-mono text-dark-400">-{formatEur(stripe)}</td>
                      <td className="px-3 py-2 font-mono text-dark-400">-{formatEur(o.applicationFeeCents)}</td>
                      <td className="px-3 py-2 font-mono text-bs-primary-300">{formatEur(net)}</td>
                      <td className="px-3 py-2 text-xs uppercase">{o.status}</td>
                    </tr>
                  );
                })}
                {orders.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-dark-500">Aucune vente sur la période.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  subtle,
  highlight,
}: {
  label: string;
  value: string;
  subtle?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${highlight ? "border-bs-primary-500/40 bg-bs-primary-500/10" : "border-dark-800 bg-dark-900/40"}`}>
      <div className="text-xs uppercase tracking-wider text-dark-400">{label}</div>
      <div className={`mt-2 font-display text-2xl font-mono ${highlight ? "text-bs-primary-300" : subtle ? "text-dark-300" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function RangeLink({ current, value }: { current: number; value: number }) {
  const active = current === value;
  return (
    <Link
      href={`/finance?days=${value}`}
      className={`rounded-full px-3 py-1 text-xs ${active ? "bg-bs-primary-500 text-dark-950" : "border border-dark-700 text-dark-300 hover:border-bs-primary-400"}`}
    >
      {value} j
    </Link>
  );
}
