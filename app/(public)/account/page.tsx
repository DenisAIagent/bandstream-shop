import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentFan } from "@/lib/fan-auth";
import { formatEur } from "@/lib/pricing/breakdown";
import { signInvoiceToken } from "@/lib/invoices/token";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Icon,
  Logo,
} from "@/components/ui";
import { logoutFanAction } from "./logout-action";
import { eraseFanDataAction } from "./data-rights-actions";

export const metadata: Metadata = {
  title: "Mon compte",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PAID: "Payée",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  REFUNDED: "Remboursée",
  CANCELLED: "Annulée",
};

const STATUS_TONE: Record<string, "default" | "mint" | "red"> = {
  PAID: "default",
  SHIPPED: "mint",
  DELIVERED: "mint",
  REFUNDED: "red",
  CANCELLED: "red",
};

interface ShippingAddressShape {
  city?: string;
  country?: string;
}

function readCity(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const addr = json as ShippingAddressShape;
  if (addr.city && addr.country) return `${addr.city}, ${addr.country}`;
  return addr.city ?? addr.country ?? null;
}

export default async function FanAccountPage() {
  const fan = await getCurrentFan();
  if (!fan) {
    redirect("/account/login?next=/account");
  }

  /**
   * On linke par email parce que l'auth fan est arrivée après les
   * commandes guest existantes. Toute commande dont `Order.fanEmail`
   * matche l'email du compte connecté est rattachée — pas besoin de
   * migration ni de FK rétroactive.
   */
  const orders = await prisma.order.findMany({
    where: { fanEmail: fan.email },
    orderBy: { createdAt: "desc" },
    include: {
      shop: {
        select: {
          displayName: true,
          artist: { select: { slug: true } },
        },
      },
      items: {
        select: {
          id: true,
          titleSnapshot: true,
          variantSnapshot: true,
          unitPriceCents: true,
          quantity: true,
        },
      },
      downloadGrants: {
        select: {
          id: true,
          product: {
            select: {
              title: true,
              digitalAssets: {
                orderBy: { position: "asc" },
                select: { id: true, fileName: true },
              },
            },
          },
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-bs-offwhite px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Logo variant="black" size={20} />
          </Link>
          <form action={logoutFanAction}>
            <Button type="submit" variant="ghost" size="sm">
              <Icon name="x" size={14} /> Se déconnecter
            </Button>
          </form>
        </header>

        <div className="mb-6">
          <h1 className="font-display text-[34px] font-medium leading-tight">
            Salut {fan.name ?? fan.email.split("@")[0]} 👋
          </h1>
          <p className="mt-1 text-[13px] text-bs-gray-700">
            Connecté en tant que <strong>{fan.email}</strong>. Voici l'historique
            de tes commandes sur band.stream Shop.
          </p>
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardBody>
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Icon name="package" size={28} />
                <p className="text-[14px] text-bs-gray-700">
                  Aucune commande pour le moment.
                </p>
                <Button variant="primary" size="sm" asChild>
                  <Link href="/">Découvrir des artistes</Link>
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const itemCount = order.items.reduce(
                (s, it) => s + it.quantity,
                0,
              );
              const city = readCity(order.shippingAddress);
              const tone = STATUS_TONE[order.status] ?? "default";
              return (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-bs-gray-500">
                          Commande #{order.publicNumber}
                        </p>
                        <h2 className="mt-1 truncate font-display text-[20px] font-medium">
                          <Link
                            href={`/${order.shop.artist.slug}`}
                            className="hover:underline"
                          >
                            {order.shop.displayName}
                          </Link>
                        </h2>
                        <p className="mt-1 text-[12px] text-bs-gray-600">
                          {order.createdAt.toLocaleDateString("fr-FR", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                          {city ? ` · livraison ${city}` : ""}
                        </p>
                      </div>
                      <Chip variant={tone}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </Chip>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <ul className="space-y-2 text-[13px]">
                      {order.items.map((it) => (
                        <li
                          key={it.id}
                          className="flex items-start justify-between gap-3 border-b border-black/[0.06] pb-2 last:border-0 last:pb-0"
                        >
                          <span className="min-w-0">
                            <span className="font-medium text-bs-black">
                              {it.quantity} × {it.titleSnapshot}
                            </span>
                            {it.variantSnapshot && (
                              <span className="block text-[12px] text-bs-gray-600">
                                {it.variantSnapshot}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 tabular-nums text-bs-black">
                            {formatEur(it.unitPriceCents * it.quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <dl className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
                      <dt className="text-bs-gray-600">Sous-total</dt>
                      <dd className="text-right tabular-nums">
                        {formatEur(order.subtotalCents)}
                      </dd>
                      <dt className="text-bs-gray-600">Livraison</dt>
                      <dd className="text-right tabular-nums">
                        {order.shippingCents > 0
                          ? formatEur(order.shippingCents)
                          : "Offerte"}
                      </dd>
                      <dt className="font-medium text-bs-black">
                        Total ({itemCount} article{itemCount > 1 ? "s" : ""})
                      </dt>
                      <dd className="text-right text-[14px] font-medium tabular-nums text-bs-black">
                        {formatEur(order.totalCents)}
                      </dd>
                    </dl>

                    {order.downloadGrants.length > 0 && (
                      <div className="mt-4 rounded-[12px] border border-bs-green-200 bg-bs-green-50 p-3">
                        <p className="text-[12px] font-medium text-bs-green-900">
                          <Icon name="sparkles" size={12} /> Téléchargements
                          digitaux
                        </p>
                        <ul className="mt-2 space-y-2">
                          {order.downloadGrants.map((g) =>
                            g.product.digitalAssets.map((a) => (
                              <li
                                key={a.id}
                                className="flex items-center justify-between gap-3 text-[12px]"
                              >
                                <span className="min-w-0 truncate">
                                  {g.product.title} —{" "}
                                  <span className="text-bs-gray-600">
                                    {a.fileName}
                                  </span>
                                </span>
                                <a
                                  href={`/api/account/downloads/${g.id}/${a.id}`}
                                  download
                                  className="shrink-0 font-medium text-bs-green-900 underline"
                                >
                                  Télécharger
                                </a>
                              </li>
                            )),
                          )}
                        </ul>
                      </div>
                    )}

                    {order.invoiceNumber && (
                      <div className="mt-3">
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={`/api/invoices/${order.id}?t=${signInvoiceToken(order.id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Télécharger la facture
                          </a>
                        </Button>
                      </div>
                    )}

                    {(order.carrier || order.trackingNumber) && (
                      <div className="mt-4 rounded-[12px] border border-black/[0.08] bg-bs-white p-3 text-[12px]">
                        <p className="font-medium text-bs-black">
                          <Icon name="truck" size={12} /> Suivi de livraison
                        </p>
                        {order.carrier && (
                          <p className="mt-1 text-bs-gray-700">
                            Transporteur : {order.carrier}
                          </p>
                        )}
                        {order.trackingNumber && (
                          <p className="text-bs-gray-700">
                            N° : <code className="bs-mono">{order.trackingNumber}</code>
                          </p>
                        )}
                        {order.shippedAt && (
                          <p className="mt-1 text-bs-gray-500">
                            Expédiée le{" "}
                            {order.shippedAt.toLocaleDateString("fr-FR")}
                          </p>
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}

        {/* Droits RGPD — export (art. 20) et effacement (art. 17) */}
        <Card className="mt-8">
          <CardHeader>
            <p className="text-[14px] font-semibold text-bs-black">
              Mes données (RGPD)
            </p>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[13px] font-medium text-bs-black">
                  Exporter mes données
                </p>
                <p className="text-[12px] text-bs-gray-700">
                  Commandes, avis et informations de compte au format JSON.
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <a href="/api/account/export" download>
                  Exporter (JSON)
                </a>
              </Button>
            </div>
            <form
              action={eraseFanDataAction}
              className="mt-5 border-t border-black/[0.08] pt-5"
            >
              <p className="text-[13px] font-medium text-bs-black">
                Effacer mes données
              </p>
              <p className="mt-1 text-[12px] leading-[1.6] text-bs-gray-700">
                Vos nom, email et adresses sont anonymisés sur toutes vos
                commandes, vos liens de téléchargement et votre compte sont
                supprimés. Les montants restent archivés (obligations
                comptables). Cette action est irréversible.
              </p>
              <label className="mt-3 flex items-center gap-2 text-[12px] text-bs-black">
                <input type="checkbox" name="confirm" required />
                Je comprends que cette action est définitive.
              </label>
              <Button variant="ghost" size="sm" type="submit" className="mt-3">
                Effacer définitivement mes données
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="mt-8 text-center text-[11px] text-bs-gray-500">
          Une question sur une commande ? Contacte directement l'artiste depuis
          sa page boutique.
        </p>
      </div>
    </main>
  );
}
