"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loginArtist } from "./actions";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await loginArtist(formData);
      if (result.success) {
        const next = sp.get("next") ?? "/dashboard";
        router.push(next);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-dark-950 p-6 text-white">
      <form action={onSubmit} className="w-full max-w-md space-y-6 rounded-3xl border border-dark-800 bg-dark-900/60 p-8">
        <div>
          <h1 className="font-display text-3xl">Connexion</h1>
          <p className="mt-2 text-sm text-dark-400">Accède à ta boutique band.stream.</p>
        </div>
        <div className="space-y-3">
          <Field name="email" label="Email" type="email" required />
          <Field name="password" label="Mot de passe" type="password" required />
        </div>
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-green-accent px-6 py-3 font-semibold text-dark-950 transition hover:bg-green-dark disabled:opacity-50"
        >
          {pending ? "Connexion…" : "Se connecter"}
        </button>
        <p className="text-center text-sm text-dark-400">
          Pas encore inscrit ?{" "}
          <Link href="/register" className="text-bs-primary-400 hover:underline">
            Créer mon compte
          </Link>
        </p>
      </form>
    </main>
  );
}

function Field(props: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-dark-400">{props.label}</span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        required={props.required}
        className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-white outline-none transition focus:border-bs-primary-400"
      />
    </label>
  );
}
