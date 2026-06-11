"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Bandeau cookies RGPD-friendly affiché au premier visiteur.
 *
 * Comportement :
 *   - À l'arrivée, vérifie le cookie `bs_consent` (lecture browser-side).
 *   - Si absent → affiche le bandeau avec 3 boutons : Tout accepter,
 *     Refuser, Personnaliser (ouvre détails).
 *   - Au clic, écrit le consent en cookie (13 mois) et appelle les
 *     fonctions de mise à jour des pixels actifs :
 *       • Google : `gtag('consent', 'update', { ad_storage: 'granted', … })`
 *       • Meta   : `fbq('consent', 'grant')`
 *       • TikTok : `ttq.enableCookie()`
 *   - Snapchat et Pinterest n'ont pas de toggle natif côté Pixel — on
 *     considère qu'ils respectent le consent global du navigateur (ITP).
 *
 * V1.1 : passer en composant cookieless (consent stocké côté backend
 * pour éviter le pré-flickering du bandeau au F5).
 */

const COOKIE_NAME = "bs_consent";
const COOKIE_DAYS = 395; // 13 mois — limite CNIL

type Consent = "accepted" | "declined";

function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`),
  );
  if (!match) return null;
  const v = decodeURIComponent(match[1]);
  return v === "accepted" || v === "declined" ? v : null;
}

function writeConsent(value: Consent) {
  const maxAge = COOKIE_DAYS * 24 * 60 * 60;
  document.cookie = `${COOKIE_NAME}=${value}; max-age=${maxAge}; path=/; samesite=lax${
    location.protocol === "https:" ? "; secure" : ""
  }`;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: { enableCookie?: () => void };
  }
}

export function CookieBanner() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setHydrated(true);
  }, []);

  function accept() {
    writeConsent("accepted");
    setConsent("accepted");
    // ShopTrackingScripts écoute cet événement et injecte les pixels
    // SEULEMENT maintenant (aucun script tiers n'était chargé avant) —
    // pas besoin de gtag/fbq update : leur init post-consentement part
    // directement en « granted ».
    window.dispatchEvent(new CustomEvent("bs:consent", { detail: "accepted" }));
  }

  function decline() {
    writeConsent("declined");
    setConsent("declined");
    // Aucun pixel n'a été chargé (gate dans ShopTrackingScripts) et aucun
    // ne le sera : refuser = zéro requête tierce, même poids qu'accepter.
    window.dispatchEvent(new CustomEvent("bs:consent", { detail: "declined" }));
  }

  if (!hydrated || consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Préférences cookies"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl rounded-[16px] border border-black/[0.08] bg-bs-white p-4 shadow-bs-3 md:inset-x-auto md:right-5 md:bottom-5 md:left-5 md:p-5"
    >
      <p className="text-[13px] font-medium text-bs-black">
        Cookies & confidentialité
      </p>
      <p className="mt-1 text-[12px] leading-[1.6] text-bs-gray-700">
        Cette boutique souhaite utiliser des cookies et pixels de mesure
        d'audience (Google Analytics) et de publicité (Google Ads, Meta,
        TikTok, Pinterest, Snapchat). Rien n'est activé sans ton accord,
        et tu peux changer d'avis à tout moment.{" "}
        <Link
          href="/aide#fans-donnees-fan"
          className="text-bs-green-700 underline-offset-[3px] hover:underline"
        >
          En savoir plus
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={accept}
          className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-bs-black px-4 text-[13px] font-medium text-bs-white transition-opacity hover:opacity-90"
        >
          Tout accepter
        </button>
        <button
          type="button"
          onClick={decline}
          className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-black/[0.14] bg-bs-white px-4 text-[13px] font-medium text-bs-black transition-colors hover:border-bs-black"
        >
          Refuser
        </button>
      </div>
    </div>
  );
}
