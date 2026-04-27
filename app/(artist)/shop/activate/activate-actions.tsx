"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createShopAction, startStripeOnboardingAction } from "./server-actions";

export function CreateShopForm({ artistName }: { artistName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createShopAction(formData);
      if (!res.success) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <Field name="displayName" label="Nom de la boutique" defaultValue={artistName} required />
      <Field name="contactEmail" label="Email de contact public" type="email" required />
      <textarea
        name="description"
        placeholder="Description courte (optionnel)"
        className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-white outline-none transition focus:border-bs-primary-400"
        rows={2}
      />
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-green-accent px-4 py-2 text-sm font-semibold text-dark-950 transition hover:bg-green-dark disabled:opacity-50"
      >
        {pending ? "Création…" : "Créer la boutique"}
      </button>
    </form>
  );
}

export function CreateStripeAccountButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    setError(null);
    startTransition(async () => {
      const res = await startStripeOnboardingAction();
      if (!res.success) setError(res.error);
      else if (res.url) window.location.href = res.url;
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-full bg-bs-primary-500 px-4 py-2 text-sm font-semibold text-dark-950 transition hover:bg-bs-primary-400 disabled:opacity-50"
      >
        {pending ? "Connexion…" : "Connecter mon compte Stripe"}
      </button>
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}

export function ContinueOnboardingButton() {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await startStripeOnboardingAction();
      if (res.success && res.url) window.location.href = res.url;
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-full border border-bs-primary-500 px-4 py-2 text-sm font-semibold text-bs-primary-400 transition hover:bg-bs-primary-500/10 disabled:opacity-50"
    >
      {pending ? "Redirection…" : "Continuer la vérification Stripe"}
    </button>
  );
}

function Field(props: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-dark-400">{props.label}</span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue}
        required={props.required}
        className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-white outline-none transition focus:border-bs-primary-400"
      />
    </label>
  );
}

