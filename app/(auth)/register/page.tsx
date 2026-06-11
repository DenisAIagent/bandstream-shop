"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerArtist } from "./actions";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Icon,
  Input,
  Label,
  Logo,
} from "@/components/ui";

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
    <main className="grid min-h-screen place-items-center bg-bs-offwhite px-6 py-10 text-bs-black">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo variant="black" size={26} withSubtitle priority />
        </div>
        <Card className="shadow-bs-2">
          <CardHeader>
            <Chip variant="mint" className="self-start">
              <Icon name="sparkles" size={11} /> Plan Pro · 10 €/mois
            </Chip>
            <h1 className="mt-2 font-display text-[clamp(1.75rem,3vw,2.25rem)] font-medium leading-tight tracking-[-0.02em]">
              Activer ma boutique
            </h1>
            <p className="text-[14px] text-bs-gray-700">
              Plan Pro requis · 3 % par vente · Stripe Connect.
            </p>
          </CardHeader>
          <CardBody>
            <form action={onSubmit} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="email">Email professionnel</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="contact@artiste.com"
                />
              </div>
              <div>
                <Label htmlFor="artistName">Nom d'artiste / groupe</Label>
                <Input id="artistName" name="artistName" required />
              </div>
              <div>
                <Label htmlFor="countryCode">Pays (ISO-2)</Label>
                <Input
                  id="countryCode"
                  name="countryCode"
                  maxLength={2}
                  required
                  defaultValue="FR"
                  className="font-mono uppercase"
                />
              </div>
              <div>
                <Label htmlFor="password">Mot de passe (min 12 car.)</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={12}
                  required
                />
              </div>
              <label className="flex items-start gap-2 text-sm text-bs-gray-700">
                <input
                  type="checkbox"
                  name="acceptTerms"
                  required
                  className="mt-1 size-4 accent-bs-green"
                />
                <span>
                  J'accepte les{" "}
                  <a
                    href="/legal/cgu-vendeurs"
                    target="_blank"
                    rel="noreferrer"
                    className="text-bs-green-700 underline underline-offset-[3px]"
                  >
                    CGU Vendeurs
                  </a>{" "}
                  (commission, obligations du vendeur) et la politique de
                  confidentialité band.stream.
                </span>
              </label>
              {error && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <Button type="submit" disabled={pending} variant="primary" size="lg">
                {pending ? "Création en cours…" : "Créer mon compte"}
              </Button>
            </form>
            <p className="mt-1 text-center text-sm text-bs-gray-700">
              Déjà inscrit ?{" "}
              <Link
                href="/login"
                className="text-bs-green-700 underline-offset-[3px] hover:underline"
              >
                Connexion
              </Link>
            </p>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
