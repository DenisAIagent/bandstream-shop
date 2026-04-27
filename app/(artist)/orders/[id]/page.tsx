import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { formatEur, realizedBreakdown } from "@/lib/pricing/breakdown";
import { MarkShipped, Refund } from "./order-actions";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let artist;
  try {
    artist = await requireArtist();
    requirePro(artist);
  } catch {
    redirect(`/login?next=/orders/${id}`);
  }
  const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
  if (!shop) redirect("/shop/activate");
  const order = await prisma.order.findFirst({
    where: { id, shopId: shop.id },
    include: { items: true },
  });
  if (!order) notFound();

  const bd = realizedBreakdown({
    grossCents: order.totalCents,
    applicationFeeCents: order.applicationFeeCents,
    stripeFeeCents: order.stripeFeeCents,
  });

  return (
    <main className="min-h-screen bg-dark-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-bs-primary-400">Commande</p>
            <h1 className="font-display text-3xl">{order.publicNumber}</h1>
            <p className="mt-1 text-sm text-dark-400">
              {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(order.createdAt)}
            </p>
          </div>
          <span className="rounded-full bg-bs-primary-500/15 px-3 py-1 text-xs font-medium text-bs-primary-300">
            {order.status}
          </span>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <Card title="Fan">
            <div>{order.fanName}</div>
            <div className="text-dark-400">{order.fanEmail}</div>
            {order.shippingAddress && typeof order.shippingAddress === "object" && (
              <pre className="mt-3 whitespace-pre-wrap text-xs text-dark-400">
                {JSON.stringify(order.shippingAddress, null, 2)}
              </pre>
            )}
          </Card>
          <Card title="Décomposition">
            <Row k="Brut" v={formatEur(bd.grossCents)} />
            <Row k="Frais Stripe (estim.)" v={`-${formatEur(bd.stripeFeeCents)}`} />
            <Row k="Commission band.stream" v={`-${formatEur(bd.commissionCents)}`} />
            <Row k="Net reçu" v={formatEur(bd.netCents)} bold />
          </Card>
        </section>

        <section className="rounded-2xl border border-dark-800 bg-dark-900/40 p-5">
          <h2 className="mb-3 font-display text-lg">Articles</h2>
          <ul className="divide-y divide-dark-800">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between py-3">
                <div>
                  <div>{it.titleSnapshot}</div>
                  {it.variantSnapshot && <div className="text-xs text-dark-400">{it.variantSnapshot}</div>}
                </div>
                <div className="font-mono">
                  {it.quantity} × {formatEur(it.unitPriceCents)}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-dark-800 bg-dark-900/40 p-5">
          <h2 className="mb-3 font-display text-lg">Expédition</h2>
          {order.shippedAt ? (
            <div className="text-sm text-bs-primary-300">
              ✅ Expédié le {order.shippedAt.toLocaleDateString("fr-FR")} via {order.carrier}
              {order.trackingNumber && (
                <div className="text-dark-400">Tracking · <code>{order.trackingNumber}</code></div>
              )}
            </div>
          ) : (
            <MarkShipped orderId={order.id} />
          )}
        </section>

        {order.status !== "REFUNDED" && (
          <section className="rounded-2xl border border-dark-800 bg-dark-900/40 p-5">
            <h2 className="mb-3 font-display text-lg">Remboursement</h2>
            <Refund orderId={order.id} totalCents={order.totalCents} />
          </section>
        )}
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dark-800 bg-dark-900/40 p-5">
      <h2 className="mb-3 font-display text-lg">{title}</h2>
      <div className="space-y-1 text-sm text-dark-200">{children}</div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${bold ? "border-t border-dark-800 pt-2 text-bs-primary-400" : "text-dark-300"}`}>
      <span>{k}</span>
      <span className={`font-mono ${bold ? "font-bold" : ""}`}>{v}</span>
    </div>
  );
}
