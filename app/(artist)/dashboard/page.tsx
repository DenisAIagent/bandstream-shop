import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { formatEur } from "@/lib/pricing/breakdown";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let artist;
  try {
    artist = await requireArtist();
    requirePro(artist);
  } catch {
    redirect("/login?next=/dashboard");
  }
  const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
  if (!shop) redirect("/shop/activate");

  const now = Date.now();
  const days30 = new Date(now - 30 * 86400_000);
  const days60 = new Date(now - 60 * 86400_000);

  const [orders30, orders30to60, productsCount, openOrdersCount, topProductsRaw, topSourcesRaw] = await Promise.all([
    prisma.order.findMany({
      where: { shopId: shop.id, createdAt: { gte: days30 } },
      select: { totalCents: true, applicationFeeCents: true, stripeFeeCents: true, refundedAmountCents: true, utmSource: true },
    }),
    prisma.order.findMany({
      where: { shopId: shop.id, createdAt: { gte: days60, lt: days30 } },
      select: { totalCents: true, refundedAmountCents: true },
    }),
    prisma.product.count({ where: { shopId: shop.id, status: "PUBLISHED" } }),
    prisma.order.count({ where: { shopId: shop.id, status: "PAID" } }),
    prisma.orderItem.groupBy({
      by: ["productId", "titleSnapshot"],
      where: { order: { shopId: shop.id, createdAt: { gte: days30 } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.order.groupBy({
      by: ["utmSource"],
      where: { shopId: shop.id, createdAt: { gte: days30 } },
      _count: { id: true },
      _sum: { totalCents: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ]);

  const totals30 = orders30.reduce(
    (acc, o) => {
      const refunded = o.refundedAmountCents ?? 0;
      const grossNet = o.totalCents - refunded;
      acc.gross += grossNet;
      acc.commission += o.applicationFeeCents;
      acc.stripe += o.stripeFeeCents ?? 0;
      acc.count += 1;
      return acc;
    },
    { gross: 0, commission: 0, stripe: 0, count: 0 },
  );
  const net30 = totals30.gross - totals30.stripe - totals30.commission;
  const aov30 = totals30.count > 0 ? Math.round(totals30.gross / totals30.count) : 0;

  const totals30to60 = orders30to60.reduce((acc, o) => {
    const refunded = o.refundedAmountCents ?? 0;
    return { gross: acc.gross + (o.totalCents - refunded), count: acc.count + 1 };
  }, { gross: 0, count: 0 });
  const grossDelta = totals30to60.gross > 0 ? ((totals30.gross - totals30to60.gross) / totals30to60.gross) * 100 : null;

  return (
    <main className="min-h-screen bg-dark-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-bs-primary-400">Boutique · {shop.displayName}</p>
            <h1 className="font-display text-3xl">Bienvenue, {artist.artistName}</h1>
          </div>
          <nav className="flex gap-2 text-sm">
            <NavLink href="/products">Produits</NavLink>
            <NavLink href="/orders">Commandes</NavLink>
            <NavLink href="/finance">Finance</NavLink>
            <NavLink href="/settings">Réglages</NavLink>
          </nav>
        </header>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card label="CA brut · 30 j" value={formatEur(totals30.gross)} delta={grossDelta} />
          <Card label="Net reçu · 30 j" value={formatEur(net30)} highlight />
          <Card label="Commandes · 30 j" value={String(totals30.count)} />
          <Card label="Panier moyen" value={formatEur(aov30)} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Panel title="Top produits (30 j)">
            {topProductsRaw.length === 0 ? (
              <Empty />
            ) : (
              <ul className="space-y-2 text-sm">
                {topProductsRaw.map((p) => (
                  <li key={p.productId} className="flex items-baseline justify-between">
                    <span className="truncate">{p.titleSnapshot}</span>
                    <span className="font-mono text-bs-primary-300">{p._sum.quantity ?? 0}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Sources (UTM, 30 j)">
            {topSourcesRaw.length === 0 ? (
              <Empty />
            ) : (
              <ul className="space-y-2 text-sm">
                {topSourcesRaw.map((s, i) => (
                  <li key={i} className="flex items-baseline justify-between">
                    <span className="truncate">{s.utmSource || "direct / non renseigné"}</span>
                    <span className="font-mono text-bs-primary-300">
                      {s._count?.id ?? 0} · {formatEur(s._sum?.totalCents ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Stat label="Produits publiés" value={String(productsCount)} href="/products" />
          <Stat label="Commandes à expédier" value={String(openOrdersCount)} href="/orders" />
          <Stat label="Intégrations" value="GMC · Meta" href="/integrations/gmc" />
        </section>
      </div>
    </main>
  );
}

function Card({ label, value, delta, highlight }: { label: string; value: string; delta?: number | null; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${highlight ? "border-bs-primary-500/40 bg-bs-primary-500/10" : "border-dark-800 bg-dark-900/40"}`}>
      <div className="text-xs uppercase tracking-wider text-dark-400">{label}</div>
      <div className={`mt-2 font-display text-2xl font-mono ${highlight ? "text-bs-primary-300" : "text-white"}`}>{value}</div>
      {typeof delta === "number" && (
        <div className={`mt-1 text-xs ${delta >= 0 ? "text-bs-primary-400" : "text-red-300"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)} % vs 30 j précédents
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dark-800 bg-dark-900/40 p-5">
      <h2 className="mb-3 font-display text-lg">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-dark-800 bg-dark-900/40 p-5 transition hover:border-bs-primary-500/50"
    >
      <div className="text-xs uppercase tracking-wider text-dark-400">{label}</div>
      <div className="mt-2 font-display text-xl">{value}</div>
    </Link>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-full border border-dark-800 px-3 py-1.5 text-dark-300 hover:border-bs-primary-400">
      {children}
    </Link>
  );
}

function Empty() {
  return <p className="text-sm text-dark-500">Pas encore de données.</p>;
}
