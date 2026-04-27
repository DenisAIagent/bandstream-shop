"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerArtist } from "./actions";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await registerArtist(formData);
      if (result.success) {
        router.push("/shop/activate");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-dark-950 p-6 text-white">
      <form action={onSubmit} className="w-full max-w-md space-y-6 rounded-3xl border border-dark-800 bg-dark-900/60 p-8">
        <div>
          <h1 className="font-display text-3xl">Activer ma boutique</h1>
          <p className="mt-2 text-sm text-dark-400">Plan Pro requis · 10 € / mois · 3 % par vente.</p>
        </div>
        <div className="space-y-3">
          <Field name="email" label="Email professionnel" type="email" required />
          <Field name="artistName" label="Nom d'artiste / groupe" required />
          <Field name="countryCode" label="Pays (ISO-2)" maxLength={2} required defaultValue="FR" />
          <Field name="password" label="Mot de passe (min 12 car.)" type="password" minLength={12} required />
          <label className="flex items-start gap-2 text-sm text-dark-300">
            <input type="checkbox" name="acceptTerms" required className="mt-0.5" />
            <span>J'accepte les CGU et la politique de confidentialité band.stream.</span>
          </label>
        </div>
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-green-accent px-6 py-3 font-semibold text-dark-950 transition hover:bg-green-dark disabled:opacity-50"
        >
          {pending ? "Création en cours…" : "Créer mon compte"}
        </button>
        <p className="text-center text-sm text-dark-400">
          Déjà inscrit ?{" "}
          <Link href="/login" className="text-bs-primary-400 hover:underline">
            Connexion
          </Link>
        </p>
      </form>
    </main>
  );
}

function Field(props: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-dark-400">{props.label}</span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        required={props.required}
        minLength={props.minLength}
        maxLength={props.maxLength}
        defaultValue={props.defaultValue}
        className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-white outline-none transition focus:border-bs-primary-400"
      />
    </label>
  );
}
