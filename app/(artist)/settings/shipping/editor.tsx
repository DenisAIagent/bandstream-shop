"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveShippingZoneAction, deleteShippingZoneAction, addShippingZoneAction } from "./server-actions";

interface Zone {
  id: string;
  name: string;
  countries: string[];
  flatRateCents: number;
  freeAboveCents: number | null;
  estimatedDays: number;
  carrier: string;
  enabled: boolean;
}

const inputCx =
  "rounded-md border border-dark-700 bg-dark-900 px-2 py-1.5 text-sm text-white outline-none focus:border-bs-primary-400";

export function ShippingZonesEditor({ zones }: { zones: Zone[] }) {
  return (
    <div className="space-y-3">
      {zones.map((z) => (
        <ZoneRow key={z.id} zone={z} />
      ))}
      <NewZoneButton />
    </div>
  );
}

function ZoneRow({ zone }: { zone: Zone }) {
  const router = useRouter();
  const [state, setState] = useState(zone);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Zone>(k: K, v: Zone[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveShippingZoneAction({
        id: state.id,
        name: state.name,
        countries: state.countries,
        flatRateCents: state.flatRateCents,
        freeAboveCents: state.freeAboveCents,
        estimatedDays: state.estimatedDays,
        carrier: state.carrier,
        enabled: state.enabled,
      });
      if (res.success) router.refresh();
      else setError(res.error);
    });
  }

  function remove() {
    if (!confirm(`Supprimer la zone « ${state.name} » ? Les fans dans ${state.countries.join(", ")} ne pourront plus commander.`)) return;
    startTransition(async () => {
      await deleteShippingZoneAction({ id: state.id });
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-dark-800 bg-dark-900/40 p-4">
      <div className="grid gap-3 md:grid-cols-12">
        <input className={`${inputCx} md:col-span-2`} value={state.name} onChange={(e) => update("name", e.target.value)} placeholder="Nom" />
        <input
          className={`${inputCx} md:col-span-3`}
          value={state.countries.join(",")}
          onChange={(e) => update("countries", e.target.value.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean))}
          placeholder="FR,BE,DE…"
        />
        <input className={`${inputCx} md:col-span-2`} value={state.carrier} onChange={(e) => update("carrier", e.target.value)} placeholder="Transporteur" />
        <input
          type="number"
          min={0}
          className={`${inputCx} md:col-span-1`}
          value={state.flatRateCents}
          onChange={(e) => update("flatRateCents", Number(e.target.value))}
          placeholder="Tarif (c)"
          title="Tarif fixe en centimes (590 = 5,90 €)"
        />
        <input
          type="number"
          min={0}
          className={`${inputCx} md:col-span-1`}
          value={state.freeAboveCents ?? ""}
          onChange={(e) => update("freeAboveCents", e.target.value ? Number(e.target.value) : null)}
          placeholder="Gratuit dès (c)"
        />
        <input
          type="number"
          min={1}
          max={60}
          className={`${inputCx} md:col-span-1`}
          value={state.estimatedDays}
          onChange={(e) => update("estimatedDays", Number(e.target.value))}
          placeholder="J+"
        />
        <label className="flex items-center gap-2 text-xs text-dark-300 md:col-span-1">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(e) => update("enabled", e.target.checked)}
          />
          actif
        </label>
        <div className="flex items-center justify-end gap-2 md:col-span-1">
          <button onClick={save} disabled={pending} className="rounded-full bg-bs-primary-500 px-3 py-1 text-xs font-semibold text-dark-950 hover:bg-bs-primary-400 disabled:opacity-50">
            ✓
          </button>
          <button onClick={remove} disabled={pending} className="text-xs text-red-300 hover:underline">
            ×
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      <p className="mt-2 text-xs text-dark-500">
        Tarif {(state.flatRateCents / 100).toFixed(2)} € · gratuit dès {state.freeAboveCents ? `${(state.freeAboveCents / 100).toFixed(0)} €` : "—"} · livré J+{state.estimatedDays}
      </p>
    </div>
  );
}

function NewZoneButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const res = await addShippingZoneAction({
        name: "NEW_ZONE",
        countries: ["XX"],
        flatRateCents: 990,
        freeAboveCents: null,
        estimatedDays: 7,
        carrier: "À définir",
        enabled: false,
      });
      if (res.success) router.refresh();
    });
  }
  return (
    <button
      type="button"
      onClick={add}
      disabled={pending}
      className="rounded-full border border-dark-700 px-4 py-2 text-sm text-dark-300 hover:border-bs-primary-400 disabled:opacity-50"
    >
      + ajouter une zone
    </button>
  );
}
