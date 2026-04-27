"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setVacationAction, closeShopAction, reopenShopAction } from "./server-actions";

export function SettingsForm({ status, vacationUntil }: { status: string; vacationUntil: string }) {
  const router = useRouter();
  const [until, setUntil] = useState(vacationUntil);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setVacation() {
    setError(null);
    startTransition(async () => {
      const res = await setVacationAction({ until });
      if (res.success) router.refresh();
      else setError(res.error);
    });
  }

  function reopen() {
    startTransition(async () => {
      await reopenShopAction();
      router.refresh();
    });
  }

  function close() {
    if (!confirm("Fermeture définitive de la boutique. Les commandes en cours doivent être traitées avant. Continuer ?")) return;
    startTransition(async () => {
      const res = await closeShopAction();
      if (res.success) router.push("/");
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-dark-800 bg-dark-900/40 p-6">
        <h2 className="font-display text-lg">Statut actuel</h2>
        <p className="mt-1 text-sm text-dark-300">
          <code className="rounded bg-dark-950 px-2 py-0.5 text-bs-primary-300">{status}</code>
        </p>
        {status === "VACATION" && (
          <button
            type="button"
            onClick={reopen}
            disabled={pending}
            className="mt-3 rounded-full bg-bs-primary-500 px-4 py-2 text-sm font-semibold text-dark-950 hover:bg-bs-primary-400 disabled:opacity-50"
          >
            Réouvrir la boutique
          </button>
        )}
      </section>

      {status === "ACTIVE" && (
        <section className="rounded-2xl border border-dark-800 bg-dark-900/40 p-6">
          <h2 className="font-display text-lg">Mode vacances</h2>
          <p className="mt-1 text-sm text-dark-400">
            Met la boutique en pause jusqu'à une date. Les fans verront un bandeau, aucune nouvelle commande possible.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-white"
            />
            <button
              type="button"
              onClick={setVacation}
              disabled={pending || !until}
              className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-dark-950 hover:bg-amber-400 disabled:opacity-50"
            >
              Activer le mode vacances
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
        <h2 className="font-display text-lg text-red-300">Zone dangereuse</h2>
        <p className="mt-1 text-sm text-dark-400">
          Fermeture définitive : les produits ne sont plus visibles, l'URL renvoie un message « Cette boutique est fermée ». Les données sont conservées 10 ans pour conformité comptable.
        </p>
        <button
          type="button"
          onClick={close}
          disabled={pending}
          className="mt-3 rounded-full border border-red-500/50 px-5 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
        >
          Fermer définitivement
        </button>
      </section>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
    </div>
  );
}
