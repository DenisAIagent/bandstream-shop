"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markShippedAction, refundOrderAction } from "./server-actions";
import { formatEur } from "@/lib/pricing/breakdown";

const CARRIERS = ["La Poste", "Colissimo", "Mondial Relay", "Chronopost", "DHL", "UPS", "FedEx", "Autre"];

export function MarkShipped({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState(CARRIERS[0]);
  const [tracking, setTracking] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await markShippedAction({ orderId, carrier, trackingNumber: tracking || null });
      if (res.success) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs uppercase tracking-wider text-dark-400">Transporteur</span>
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-white"
          >
            {CARRIERS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs uppercase tracking-wider text-dark-400">Tracking (optionnel)</span>
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-white"
          />
        </label>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded-full bg-green-accent px-5 py-2 text-sm font-semibold text-dark-950 transition hover:bg-green-dark disabled:opacity-50"
      >
        {pending ? "Envoi…" : "Marquer comme expédié"}
      </button>
    </div>
  );
}

export function Refund({ orderId, totalCents }: { orderId: string; totalCents: number }) {
  const router = useRouter();
  const [amountEur, setAmountEur] = useState((totalCents / 100).toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const cents = Math.round(parseFloat(amountEur) * 100);
      if (!Number.isFinite(cents) || cents <= 0) {
        setError("Montant invalide");
        return;
      }
      const res = await refundOrderAction({ orderId, amountCents: cents });
      if (res.success) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-dark-400">
        Total commande : <span className="font-mono">{formatEur(totalCents)}</span>. Tu peux rembourser tout ou partie.
      </p>
      <div className="flex items-center gap-3">
        <input
          value={amountEur}
          onChange={(e) => setAmountEur(e.target.value)}
          inputMode="decimal"
          className="w-32 rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-right font-mono text-white"
        />
        <span>€</span>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-full border border-red-500/50 px-5 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
        >
          {pending ? "Remboursement…" : "Rembourser"}
        </button>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}

