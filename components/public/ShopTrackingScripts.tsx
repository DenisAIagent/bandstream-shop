"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

interface ShopTrackingScriptsProps {
  ga4MeasurementId?: string | null;
  googleAdsConversionId?: string | null;
  metaPixelId?: string | null;
  tiktokPixelCode?: string | null;
  pinterestTagId?: string | null;
  snapchatPixelId?: string | null;
}

const CONSENT_COOKIE = "bs_consent";

function hasAcceptedConsent(): boolean {
  if (typeof document === "undefined") return false;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) === "accepted" : false;
}

/**
 * Injecte les pixels d'analyse / pub d'un shop UNIQUEMENT sur ses pages
 * publiques quand l'artiste a renseigné les IDs dans Réglages → Analytics.
 * Le backoffice band.stream reste hors de ces pixels.
 *
 * Pixels supportés (V1) :
 *   - Google Analytics 4 (gtag.js)
 *   - Google Ads (partage le runtime gtag avec GA4)
 *   - Meta Pixel (Facebook + Instagram, fbevents.js)
 *   - TikTok Pixel, Pinterest Tag, Snapchat Pixel
 *
 * RGPD (art. 7, lignes directrices CEPD + CNIL) : AUCUN script tiers n'est
 * chargé tant que le visiteur n'a pas cliqué « Tout accepter » dans le
 * CookieBanner — le simple chargement de gtag.js / fbevents.js transmet
 * l'IP et l'user-agent du fan à Google/Meta/TikTok. GA4 n'étant pas dans
 * la liste des mesures d'audience exemptées de consentement (CNIL), il est
 * gaté comme les pixels publicitaires. Refus ou absence de choix = zéro
 * requête tierce. Le composant écoute `bs:consent` (émis par CookieBanner)
 * pour injecter sans rechargement après acceptation.
 *
 * Note : on n'injecte rien si aucun ID n'est défini — pas de tag fantôme.
 * Cf. `<ShopAdsConversion>` pour le tir de l'event purchase à
 * `/checkout/success` (no-op si les loaders ne sont pas montés, donc
 * naturellement gaté par le même consentement).
 */
export function ShopTrackingScripts({
  ga4MeasurementId,
  googleAdsConversionId,
  metaPixelId,
  tiktokPixelCode,
  pinterestTagId,
  snapchatPixelId,
}: ShopTrackingScriptsProps) {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    setConsented(hasAcceptedConsent());
    const onConsent = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setConsented(detail === "accepted");
    };
    window.addEventListener("bs:consent", onConsent);
    return () => window.removeEventListener("bs:consent", onConsent);
  }, []);

  const ga4 = ga4MeasurementId?.trim() || null;
  const ads = googleAdsConversionId?.trim() || null;
  const meta = metaPixelId?.trim() || null;
  const tiktok = tiktokPixelCode?.trim() || null;
  const pinterest = pinterestTagId?.trim() || null;
  const snapchat = snapchatPixelId?.trim() || null;
  if (!ga4 && !ads && !meta && !tiktok && !pinterest && !snapchat) return null;

  // Pas de consentement explicite → aucune requête tierce.
  if (!consented) return null;

  return (
    <>
      {(ga4 || ads) && <GoogleTags ga4={ga4} ads={ads} />}
      {meta && <MetaPixel pixelId={meta} />}
      {tiktok && <TiktokPixel pixelCode={tiktok} />}
      {pinterest && <PinterestTag tagId={pinterest} />}
      {snapchat && <SnapchatPixel pixelId={snapchat} />}
    </>
  );
}

// ─────────── Google (GA4 + Ads) ───────────

function GoogleTags({ ga4, ads }: { ga4: string | null; ads: string | null }) {
  const loaderId = ga4 ?? ads;
  if (!loaderId) return null;

  const initScript = [
    "window.dataLayer = window.dataLayer || [];",
    "function gtag(){dataLayer.push(arguments);}",
    // Consent Mode v2 — ce script n'est monté qu'APRÈS le clic
    // « Tout accepter » du CookieBanner (cf. gate du composant parent),
    // le consentement est donc acquis au moment de l'init.
    "gtag('consent', 'default', {",
    "  ad_storage: 'granted',",
    "  ad_user_data: 'granted',",
    "  ad_personalization: 'granted',",
    "  analytics_storage: 'granted'",
    "});",
    "gtag('js', new Date());",
    ga4 ? `gtag('config', '${ga4}', { anonymize_ip: true });` : "",
    ads ? `gtag('config', '${ads}');` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${loaderId}`}
        strategy="afterInteractive"
      />
      <Script id="bs-shop-gtag-init" strategy="afterInteractive">
        {initScript}
      </Script>
    </>
  );
}

// ─────────── Meta Pixel (Facebook + Instagram) ───────────

function MetaPixel({ pixelId }: { pixelId: string }) {
  // Loader officiel Meta — `fbevents.js` est servi par Facebook directement.
  // Le snippet `!function(f,b,e,…)` est leur installation standard.
  // On se contente de loader + init + PageView. Conversion à part.
  const initScript = `
    !function(f,b,e,v,n,t,s){
      if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)
    }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
  `;
  return (
    <Script id={`bs-shop-meta-pixel-${pixelId}`} strategy="afterInteractive">
      {initScript}
    </Script>
  );
}

// ─────────── TikTok Pixel ───────────

function TiktokPixel({ pixelCode }: { pixelCode: string }) {
  // Loader officiel TikTok. La boucle `var ttq=` initialise les méthodes
  // queueable (page, track, identify, etc.) avant le chargement async.
  const initScript = `
    !function (w, d, t) {
      w.TiktokAnalyticsObject=t;
      var ttq=w[t]=w[t]||[];
      ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
      ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
      for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
      ttq.instance=function(t){
        for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);
        return e
      };
      ttq.load=function(e,n){
        var i="https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;
        ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};
        var o=document.createElement("script");
        o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;
        var a=document.getElementsByTagName("script")[0];
        a.parentNode.insertBefore(o,a)
      };
      ttq.load('${pixelCode}');
      ttq.page();
    }(window, document, 'ttq');
  `;
  return (
    <Script id={`bs-shop-tiktok-pixel-${pixelCode}`} strategy="afterInteractive">
      {initScript}
    </Script>
  );
}

// ─────────── Pinterest Tag ───────────

function PinterestTag({ tagId }: { tagId: string }) {
  // Loader officiel Pinterest. PageVisit tiré au load.
  const initScript = `
    !function(e){if(!window.pintrk){window.pintrk=function(){
      window.pintrk.queue.push(Array.prototype.slice.call(arguments))};
      var n=window.pintrk;n.queue=[],n.version="3.0";
      var t=document.createElement("script");t.async=!0,t.src=e;
      var r=document.getElementsByTagName("script")[0];
      r.parentNode.insertBefore(t,r)
    }}("https://s.pinimg.com/ct/core.js");
    pintrk('load', '${tagId}');
    pintrk('page');
  `;
  return (
    <Script id={`bs-shop-pinterest-tag-${tagId}`} strategy="afterInteractive">
      {initScript}
    </Script>
  );
}

// ─────────── Snapchat Pixel ───────────

function SnapchatPixel({ pixelId }: { pixelId: string }) {
  const initScript = `
    (function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){
      a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)
    };a.queue=[];var s='script';r=t.createElement(s);r.async=!0;
    r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(
      window,document,'https://sc-static.net/scevent.min.js');
    snaptr('init', '${pixelId}');
    snaptr('track', 'PAGE_VIEW');
  `;
  return (
    <Script id={`bs-shop-snapchat-pixel-${pixelId}`} strategy="afterInteractive">
      {initScript}
    </Script>
  );
}

// ─────────── Conversion firing (post-purchase) ───────────

interface ShopConversionProps {
  /** Google Ads — label conversion (format AW-XXX/aBcDeF). */
  googleAdsConversionLabel?: string | null;
  /** Meta Pixel ID — pour `fbq('track', 'Purchase')`. */
  metaPixelId?: string | null;
  /** TikTok Pixel Code — pour `ttq.track('CompletePayment')`. */
  tiktokPixelCode?: string | null;
  /** Pinterest Tag ID — pour `pintrk('track', 'Checkout')`. */
  pinterestTagId?: string | null;
  /** Snapchat Pixel ID — pour `snaptr('track', 'PURCHASE')`. */
  snapchatPixelId?: string | null;
  /** Montant total en EUR (optionnel, pour ROAS tracking). */
  value?: number;
  /** ID transaction unique pour déduplication serveur. */
  transactionId?: string;
}

/**
 * Tire les events de conversion sur les 3 pixels au mount. À monter sur
 * `/checkout/success` quand le paiement est confirmé. Pré-requis :
 * `<ShopTrackingScripts>` doit être monté avant (sur la même page).
 *
 * Chaque pixel a son propre nom d'event de conversion :
 *   - Google Ads : `gtag('event', 'conversion', { send_to: <label> })`
 *   - Meta : `fbq('track', 'Purchase', { value, currency })`
 *   - TikTok : `ttq.track('CompletePayment', { value, currency })`
 *
 * Si une valeur n'est pas fournie, on tire l'event sans `value` (Google
 * et Meta acceptent ; TikTok aussi).
 */
export function ShopAdsConversion({
  googleAdsConversionLabel,
  metaPixelId,
  tiktokPixelCode,
  pinterestTagId,
  snapchatPixelId,
  value,
  transactionId,
}: ShopConversionProps) {
  const adsLabel = googleAdsConversionLabel?.trim();
  const metaActive = !!metaPixelId?.trim();
  const tiktokActive = !!tiktokPixelCode?.trim();
  const pinterestActive = !!pinterestTagId?.trim();
  const snapchatActive = !!snapchatPixelId?.trim();
  if (
    !adsLabel &&
    !metaActive &&
    !tiktokActive &&
    !pinterestActive &&
    !snapchatActive
  ) {
    return null;
  }

  const valueObj =
    value !== undefined ? { value, currency: "EUR" as const } : {};
  const txObj = transactionId ? { transaction_id: transactionId } : {};

  // Google Ads
  const googleSnippet = adsLabel
    ? `if (typeof gtag === 'function') { gtag('event', 'conversion', ${JSON.stringify({ send_to: adsLabel, ...valueObj, ...txObj })}); }`
    : "";

  // Meta — Purchase event avec eventID pour déduplication CAPI (V1.x).
  const metaSnippet = metaActive
    ? `if (typeof fbq === 'function') { fbq('track', 'Purchase', ${JSON.stringify(valueObj)}${transactionId ? `, { eventID: ${JSON.stringify(transactionId)} }` : ""}); }`
    : "";

  // TikTok — CompletePayment.
  const tiktokSnippet = tiktokActive
    ? `if (typeof ttq !== 'undefined' && ttq.track) { ttq.track('CompletePayment', ${JSON.stringify({ ...valueObj, ...(transactionId ? { event_id: transactionId } : {}) })}); }`
    : "";

  // Pinterest — Checkout event.
  const pinterestSnippet = pinterestActive
    ? `if (typeof pintrk === 'function') { pintrk('track', 'checkout', ${JSON.stringify({ ...(value !== undefined ? { value, currency: "EUR" } : {}), ...(transactionId ? { order_id: transactionId } : {}) })}); }`
    : "";

  // Snapchat — PURCHASE event.
  const snapchatSnippet = snapchatActive
    ? `if (typeof snaptr === 'function') { snaptr('track', 'PURCHASE', ${JSON.stringify({ ...(value !== undefined ? { price: value, currency: "EUR" } : {}), ...(transactionId ? { transaction_id: transactionId } : {}) })}); }`
    : "";

  const combined = [
    googleSnippet,
    metaSnippet,
    tiktokSnippet,
    pinterestSnippet,
    snapchatSnippet,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Script id="bs-shop-purchase-conversion" strategy="afterInteractive">
      {combined}
    </Script>
  );
}
