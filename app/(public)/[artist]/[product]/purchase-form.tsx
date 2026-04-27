"use client";

import { useState, useTransition } from "react";
import { startCheckoutAction } from "./checkout-action";
import { formatEur } from "@/lib/pricing/breakdown";

interface VariantOpt {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  stock: number;
  priceCents: number;
}

const COUNTRIES: Array<{ code: string; label: string }> = [
  { code: "FR", label: "France métropolitaine" },
  { code: "BE", label: "Belgique" },
  { code: "CH", label: "Suisse" },
  { code: "DE", label: "Allemagne" },
  { code: "ES", label: "Espagne" },
  { code: "IT", label: "Italie" },
  { code: "LU", label: "Luxembourg" },
  { code: "NL", label: "Pays-Bas" },
  { code: "PT", label: "Portugal" },
  { code: "GB", label: "Royaume-Uni" },
  { code: "US", label: "États-Unis" },
  { code: "CA", label: "Canada" },
];

export function ProductPurchase({
  productId,
  variants,
  shopSlug,
}: {
  productId: string;
  variants: VariantOpt[];
  shopSlug: string;
}) {
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [country, setCountry] = useState("FR");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const inStock = variant && variant.stock > 0;

  function buy() {
    setError(null);
    if (!variant) return;
    startTransition(async () => {
      const res = await startCheckoutAction({
        productId,
        variantId: variant.id,
        country,
        fanEmail: email,
        fanName: name,
        shopSlug,
      });
      if (res.success) window.location.href = res.url;
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-dark-800 bg-dark-900/40 p-5">
      {variants.length > 1 && (
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-dark-400">Variante</span>
          <select
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-white outline-none focus:border-bs-primary-400"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={v.stock === 0}>
                {[v.size, v.color].filter(Boolean).join(" / ") || v.sku} ·{" "}
                {formatEur(v.priceCents)}
                {v.stock === 0 ? " · rupture" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-dark-400">Pays de livraison</span>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-white outline-none focus:border-bs-primary-400"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-dark-400">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-white outline-none focus:border-bs-primary-400"
          required
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-dark-400">Nom complet</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-white outline-none focus:border-bs-primary-400"
          required
        />
      </label>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button
        type="button"
        disabled={!inStock || pending || !email || !name}
        onClick={buy}
        className="w-full rounded-full bg-green-accent px-6 py-3 font-semibold text-dark-950 transition hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {!inStock ? "Rupture de stock" : pending ? "Redirection vers Stripe…" : "Acheter — paiement sécurisé"}
      </button>
      <p className="text-center text-xs text-dark-500">Paiement Stripe · CB, Apple Pay, Google Pay, Link.</p>
    </div>
  );
}
