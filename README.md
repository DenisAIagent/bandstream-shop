> 📘 **Document de référence : [FONCTIONNEMENT.md](https://github.com/DenisAIagent/bandstream-ecosystem/blob/main/FONCTIONNEMENT.md)**
> (repo `bandstream-ecosystem`). Cette application fait partie de l'écosystème
> band.stream — lisez d'abord le fonctionnement global ; ce README ne couvre
> que la technique de cette app.

# bandstream-shop

Module e-commerce indépendant de **band.stream**. Permet aux artistes Pro/Label de vendre du merch physique (vinyles, t-shirts, accessoires) via Stripe Connect, avec synchronisation automatique vers Google Merchant Center et Meta Catalog.

**Éditeur** : BANDSTREAM SAS — SIREN 939 221 438 — RCS Paris — 60 rue François Ier, 75008 Paris.

---

## Sommaire

- [Pricing & add-ons](#pricing--add-ons)
- [Stack technique](#stack-technique)
- [Isolation stricte vs `bandstream-app`](#isolation-stricte)
- [Démarrage local](#démarrage-local)
- [Variables d'environnement](#variables-denvironnement)
- [Commandes principales](#commandes-principales)
- [Architecture](#architecture)
- [Fonctionnalités clés](#fonctionnalités-clés)
- [Documentation détaillée](#documentation-détaillée)
- [Déploiement](#déploiement)

---

## Pricing & add-ons

| Plan | Abonnement | Add-on Boutique | Add-on Personnalisation | Commission |
|---|---|---|---|---|
| **Free** | 0 €/mois | — | — | — (pas d'accès boutique) |
| **Pro** | 5 €/mois | **+10 €/mois** (1 boutique) | +1 €/mois | 3 % par vente |
| **Label** | 25 €/mois | **+30 €/mois** (jusqu'à 100 boutiques) | +1 €/mois par shop | 0 % par vente |

> **La boutique n'est pas incluse dans les plans.** C'est un add-on payant en plus, géré côté billing band.stream principal et synchronisé via webhook (V1.x). En dev, togglable via `toggleShopAddonAction` (cf. `app/upgrade/server-actions.ts`).

Gating à 3 niveaux :
1. `lib/pricing/tier-gate.ts:requirePro` — refuse si tier `FREE` ou add-on Boutique inactif
2. `lib/shop/backoffice-context.ts:requireBackofficeContext` — redirige vers `/upgrade?addon=shop`
3. `lib/billing/plan.ts:assertCanCreateShop` — refuse la création si quota dépassé

Cf. [`docs/PRICING.md`](docs/PRICING.md) pour le détail complet.

---

## Stack technique

| Couche | Tech |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript strict |
| ORM | Prisma 5 + Postgres (instance dédiée) |
| Auth | Sessions custom (cookie httpOnly + token SHA-256 en DB) |
| Paiements | Stripe Connect Express (Modèle A : Stripe gère les tarifs) |
| Catalogues externes | Google Merchant Center (Content API), Meta Catalog (Graph API) |
| UI | Tailwind 3 + Radix UI + composants UI maison (`components/ui/`) |
| Polices | Goodly (display, locale) + Poppins (body, Google Fonts) |
| Tests | Playwright (E2E) |
| SEO | sitemap-index dynamique, JSON-LD complet (Product + Merchant Listing 2024+), OG dynamique via Satori, ISR |

---

## Isolation stricte

Ce module est **strictement indépendant** de `bandstream-app`. Aucune écriture ni import de code applicatif n'est autorisé. Seuls les assets de marque (logo, palette, polices) sont copiés en lecture dans `public/brand/`.

Vérification après chaque commit :

```bash
git -C "../bandstream-app" status --porcelain
# doit toujours retourner vide

npm run verify:isolation
# script qui contrôle les imports cross-projet
```

---

## Démarrage local

Pré-requis : **Node.js 20+**, **Postgres 14+** local, **FFmpeg** (pour les rendus HyperFrames optionnels).

```bash
# 1. Clone + install
cp .env.example .env.local
# remplir DATABASE_URL, STRIPE_*, ENCRYPTION_KEY au minimum
npm install

# 2. Migrations DB
npm run prisma:migrate

# 3. Dev server
npm run dev
# → http://localhost:3001
```

Pour la démo, le seed crée 2 shops d'exemple (`/toto` avec branding actif Foo Fighters, `/aurelle`, `/korbin`) :

```bash
npx tsx scripts/seed-toto-products.ts
npx tsx scripts/seed-label-test.ts
```

---

## Variables d'environnement

Cf. `.env.example` pour la liste complète. Les essentielles :

| Var | Rôle |
|---|---|
| `DATABASE_URL` | Postgres dédié bandstream-shop |
| `ENCRYPTION_KEY` | AES-GCM (tokens OAuth at rest) **+ dérive le HMAC des tokens de facture** |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLIC_KEY` | Stripe Connect |
| `STRIPE_WEBHOOK_SECRET` | Webhook Stripe (à configurer post-deploy) |
| `STRIPE_CONNECT_CLIENT_ID` | OAuth Stripe Connect Express |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth GMC |
| `META_APP_ID` / `META_APP_SECRET` | OAuth Meta Catalog |
| `TIKTOK_APP_ID` / `TIKTOK_APP_SECRET` | OAuth TikTok Business |
| `CRON_SECRET` | Auth des crons (`abandoned-carts`, `review-requests`, `anonymize-orders`) — Bearer ou `x-cron-secret` ; planifiés dans `vercel.json` |
| `INTERNAL_API_SECRET` | Auth de l'API interne `/api/internal/*` (ex. CRM → statut + CA d'un artiste) — header `x-internal-secret` ou Bearer |
| `RESEND_API_KEY` | Emails transactionnels (cycle de vie, relances, magic links, factures, téléchargements) |
| `NEXT_PUBLIC_SHOP_BASE_URL` | URL absolue prod (sitemap, canonical, OG, JSON-LD) |
| `COMMISSION_RATE_PRO` / `COMMISSION_RATE_LABEL` | Taux commission par tier (override possible) |
| `NEXTAUTH_SECRET` | ⚠️ **Déprécié** — auth 100 % custom, plus requis (conservé optionnel) |

> Stockage des **fichiers digitaux** : disque local privé `storage/digital/`
> (hors `public/`, gitignoré). À migrer vers R2/S3 signé en V1.1.

⚠️ **Aucun secret en dur dans le code.** Cf. [politique de sécurité](#sécurité--rgpd).

---

## Commandes principales

```bash
npm run dev               # Dev server port 3001
npm run build             # Build prod
npm run start             # Serve build prod
npm run typecheck         # tsc --noEmit (0 erreur attendu)
npm run lint              # ESLint
npm run test:e2e          # Playwright
npm run prisma:migrate    # Crée + applique migration dev
npm run prisma:studio     # GUI Postgres
npm run prisma:reset      # ⚠️ DESTRUCTIF — drop tout, replay migrations
npm run verify:isolation  # Garde-fou : aucun import bandstream-app
```

---

## Architecture

```
bandstream-shop/
├── app/
│   ├── (public)/                   # Surface fan (no auth, indexable)
│   │   ├── [artist]/               # Vitrine boutique d'un artiste
│   │   │   ├── page.tsx            # Grille produits + filtres
│   │   │   ├── opengraph-image.tsx # OG image dynamique vitrine (Satori)
│   │   │   ├── panier/             # Panier multi-produits + checkout (CGV checkbox)
│   │   │   ├── p/[slug]/           # Pages CMS par shop (Markdown safe)
│   │   │   └── [product]/          # Fiche produit
│   │   │       ├── page.tsx        # JSON-LD complet (Merchant Listing 2024+)
│   │   │       ├── opengraph-image.tsx  # OG image dynamique produit
│   │   │       ├── gallery.tsx     # Lightbox photos
│   │   │       ├── review-actions.ts    # Server action soumission avis
│   │   │       └── _components/    # ReviewForm + ReviewList
│   │   ├── search/                 # Recherche cross-shops
│   │   ├── account/                # Comptes fans : login passwordless + dashboard historique
│   │   │   ├── login/              # Magic link (form + email template)
│   │   │   ├── verify/             # Consume magic link → session 30j
│   │   │   ├── page.tsx            # Dashboard commandes (linkage par email)
│   │   │   └── logout-action.ts    # Server action déconnexion
│   │   ├── checkout/               # success / cancel
│   │   ├── associate/confirm/[token]/   # Flow rattachement label
│   │   └── legal/                  # Mentions légales globales
│   ├── (artist)/                   # Backoffice (auth + add-on Boutique requis)
│   │   ├── dashboard/              # KPI + onboarding checklist
│   │   ├── products/               # Catalogue produits
│   │   │   └── [id]/
│   │   │       ├── edit            # Édition fiche
│   │   │       └── reviews/        # Modération avis fans
│   │   ├── orders/                 # Commandes
│   │   ├── finance/                # Revenus + Stripe Connect
│   │   ├── settings/               # 7 sections (identité, branding, livraison, dispo, analytics, intégrations, danger zone)
│   │   ├── discounts/              # Manager codes promo
│   │   ├── pages/                  # Manager pages CMS (CGV générée auto à l'activation)
│   │   ├── redirects/              # Manager redirections 301/302
│   │   ├── labels/                 # Hub Label (multi-shops)
│   │   ├── integrations/           # GMC + Meta + TikTok OAuth flows
│   │   └── shop/activate/          # Onboarding wizard
│   ├── upgrade/                    # Page plans publique
│   ├── api/                        # Endpoints internes (webhooks, OAuth callbacks)
│   │   ├── stripe/webhook/         # checkout.session.completed/expired, charge.refunded
│   │   ├── tiktok/oauth/           # OAuth flow TikTok Business
│   │   └── cron/abandoned-carts/   # Cron de relance abandon panier
│   ├── sitemap.xml/route.ts        # Sitemap-index
│   ├── sitemaps/[type]/route.ts    # Sub-sitemaps (static/shops/products)
│   ├── robots.ts                   # Robots
│   └── layout.tsx                  # JSON-LD Organization + WebSite (root)
├── components/
│   ├── public/                     # ArtistHero, ProductCard, FloatingCartButton, ShopTrackingScripts, CookieBanner
│   ├── artist/                     # PageHeader, sidebar
│   └── ui/                         # Design system maison (Button, Card, Chip, Input, Icon, Logo)
├── lib/
│   ├── auth.ts                     # Sessions artistes (token SHA-256, TTL 30j)
│   ├── fan-auth.ts                 # Sessions fans (magic link 15 min + session 30j SHA-256)
│   ├── billing/
│   │   ├── plan.ts                 # Tiers + add-on logic + assertCanCreateShop
│   │   └── plan-display.ts         # PLANS pour la page /upgrade
│   ├── pricing/
│   │   ├── commission.ts           # Calcul commission par tier
│   │   ├── tier-gate.ts            # requirePro (gate plan + add-on)
│   │   └── breakdown.ts            # formatEur + ventilation TVA
│   ├── shop/
│   │   ├── backoffice-context.ts   # requireBackofficeContext (redirects)
│   │   ├── current-shop.ts         # resolveCurrentShop (cookie multi-shop label)
│   │   ├── membership.ts           # ShopMember helpers
│   │   ├── labels.ts               # Hub Label
│   │   ├── branding.ts             # Add-on Personnalisation (couleurs WCAG)
│   │   └── analytics.ts            # Validation IDs GA4/GSC/Ads/Meta/TikTok/Pinterest/Snapchat
│   ├── cart/
│   │   ├── cookie.ts               # Cookie panier scoped par shop, validation server
│   │   ├── quote.ts                # Quote (subtotal, shipping, discount, pre-order)
│   │   ├── discount.ts             # evaluateDiscountCode
│   │   └── types.ts                # Cart, CartItem, CartQuote
│   ├── stripe/
│   │   ├── connect.ts              # OAuth Stripe Connect Express
│   │   ├── checkout.ts             # Single-line legacy
│   │   ├── checkout-cart.ts        # Multi-line panier + snapshot AbandonedCart
│   │   ├── webhook.ts              # Webhook handlers (completed/expired/refunded)
│   │   └── refund.ts               # Refund flow
│   ├── gmc/sync.ts                 # syncProductToGmc / removeProductFromGmc
│   ├── meta/sync.ts                # syncProductToMeta / removeProductFromMeta
│   ├── tiktok/
│   │   ├── client.ts               # OAuth + API Catalog Business (tokens chiffrés)
│   │   ├── product-mapper.ts       # Product → schéma TikTok SKU
│   │   └── sync.ts                 # syncProductToTiktok / removeProductFromTiktok
│   ├── products/
│   │   ├── repository.ts           # CRUD produits + variantes
│   │   ├── taxonomy.ts             # Catégories GMC verrouillées (Apparel, Musique, Accessoires…)
│   │   └── presets.ts              # Templates produit (T-shirt, Vinyle, Hoodie…)
│   ├── notifications/
│   │   ├── email.ts                # sendEmail Resend (fallback console en dev)
│   │   ├── templates.ts            # Confirmation commande + notif artiste + refund
│   │   └── abandoned-cart-email.ts # Template relance H+1 (CTA Stripe + code -5%)
│   ├── cms/markdown.ts             # Parseur Markdown safe (0 dépendance, échappe HTML)
│   ├── legal/cgv-template.ts       # Template CGV auto-rempli à l'activation
│   ├── shipping/                   # Zones, frais, validation pays
│   ├── moderation/                 # Règles auto avis fan
│   └── seo/base-url.ts             # BASE_URL helper (sitemap, canonical, OG)
├── prisma/
│   ├── schema.prisma
│   └── migrations/                 # 19 migrations appliquées
├── public/                         # Assets statiques (favicons, fonts Goodly, og-default)
├── scripts/                        # Seeds, captures vidéo, sessions dev
├── styles/                         # Tokens Tailwind + globals
├── tests/                          # Playwright E2E
├── my-video/                       # HyperFrames composition (vidéo de présentation)
└── docs/                           # Documentation détaillée (cf. ci-dessous)
```

---

## Fonctionnalités clés

### Vitrine publique
- Grille produits avec filtres FR (Vêtements / Musique / Accessoires / Print / Autre)
- Tri (récent, prix asc/desc, nom A→Z), recherche texte
- Fiche produit avec galerie + lightbox, urgence stock (<50 unités)
- Panier multi-produits persistant par shop (cookie scoped), bouton flottant viewport
- Codes promo applicables au panier (PERCENT / FIXED / FREE_SHIPPING)
- Pré-commande pour les drops futurs (variante avec `isPreorder` + `availableFrom`)
- **Produits digitaux** (téléchargement) : pas d'expédition ni d'adresse, livraison par lien sécurisé après paiement
- **Name-your-price** (prix libre) : le fan choisit son prix au-dessus d'un plancher (revalidé serveur)
- **Multi-devises** : sélecteur de devise (affichage indicatif `≈`), encaissement converti par Stripe Adaptive Pricing
- Pages CMS par shop (`/<artist>/p/<slug>`) avec parser Markdown sûr
- Redirections 301/302 par shop (manager dédié backoffice)
- **Avis réservés aux acheteurs** (session fan + commande vérifiée serveur) + modération artiste + Schema.org `AggregateRating` / `Review`
- Add-on Personnalisation : logo, bandeau cover (1920×640), 4 couleurs indépendantes, voile noir réglable

### Comptes fans
- Login passwordless (magic link email, TTL 15 min, sessions 30j SHA-256)
- Page `/account` avec historique de commandes, **téléchargements digitaux** et **factures** (linkage par email avec les commandes guest existantes)
- Logout via server action (destruction cookie + DB session)

### Email & relances (cycle de vie complet)
- **Confirmation** (PAID) — inclut facture + liens de téléchargement digitaux le cas échéant
- **Expédition** (SHIPPED) — transporteur + tracking
- **Livraison** (DELIVERED) — action « Marquer comme livré »
- **Demande d'avis** différée — cron `/api/cron/review-requests` (livré ≥ 3 j ou expédié ≥ 10 j), lien « noter » par produit, idempotent (`reviewRequestedAt`)
- Notif vente artiste + email de remboursement
- **Relance abandon panier** automatisée : snapshot au clic « Payer » → cron → email code promo `-5 %` one-shot 48 h + lien Stripe ; verrou anti double-envoi

### Backoffice artiste
- Dashboard avec KPI temps réel (CA, commandes, panier moyen, top produits)
- Catalogue produits : taxonomie GMC verrouillée, presets, variantes, stock, GTIN/MPN, sale prices, pre-order, **digital (gestion fichiers)**, **prix libre**
- Commandes Stripe Connect : tracking, **marquage expédié / livré**, refund
- Finance : commission par vente, payouts Stripe, export CSV
- **Audience (CRM)** : clients agrégés, segments (Fidèles / VIP / Récents / Inactifs), export CSV + **hashé Customer Match / Custom Audiences**
- **Facturation & TVA** : statut vendeur (franchise 293 B / assujetti), facture conforme auto à chaque vente
- Codes promo : create / list / toggle / delete avec quotas + dates
- Pages CMS, redirections 301/302, modération avis (`/products/[id]/reviews`)
- Réglages organisés en 8 topics (identité, perso, livraison, dispo, analytics, **facturation**, intégrations, danger)

### Hub Label (multi-shops)
- Un compte Label peut administrer jusqu'à 100 boutiques
- Création de boutiques managées (artistes-marques sans login direct)
- Rattachement de boutiques d'artistes existants via flow d'invitation email
- Dashboard agrégé multi-shops

### SEO Shopify-grade
- Sitemap-index + 3 sub-sitemaps (`/sitemaps/static.xml`, `/shops.xml`, `/products.xml`)
- `robots.ts` avec Disallow backoffice, Allow public
- `generateMetadata()` sur toutes les pages publiques (canonical, OG, twitter, robots)
- JSON-LD complet (`Organization`, `WebSite`, `Product`, `BreadcrumbList`, `AggregateRating`, `Review`, `OfferShippingDetails`, `MerchantReturnPolicy`)
- Conformité Merchant Listing 2024+ (shipping/return/priceValidUntil)
- OG image dynamique brandée par shop (Satori)
- ISR `revalidate=300` avec `revalidatePath` sur toutes les mutations

### Analytics par shop (7 pixels)
Chaque artiste branche **ses propres** comptes pub/analyse :
- **Google Analytics 4** (Measurement ID `G-…`)
- **Google Search Console** (code de vérification meta tag)
- **Google Ads** (ID `AW-…` + label conversion `AW-…/…`)
- **Meta Pixel** (Facebook + Instagram, 14-17 chiffres)
- **TikTok Pixel** (16-32 chars alphanum)
- **Pinterest Tag** (13 chiffres)
- **Snapchat Pixel** (UUID alphanum)

Tags injectés uniquement sur ses pages publiques (`/<slug>/*`). À `/checkout/success`, les events de conversion sont tirés en parallèle sur chaque pixel actif (`gtag conversion` + `fbq Purchase` + `ttq CompletePayment` + `pintrk track Checkout` + `snaptr track PURCHASE`) avec `transaction_id`/`event_id` pour la déduplication CAPI server-side (V1.2).

**Consent Mode v2** default-deny pour `ad_storage` (RGPD-compatible). Bandeau cookies (`<CookieBanner>`) shippé : à l'opt-in il appelle `gtag('consent','update')` + `fbq('consent','grant')` + `ttq.enableCookie()` + équivalents Pinterest/Snapchat.

### Intégrations
- **Stripe Connect Express** — onboarding KYC + payouts
- **Google Merchant Center** — sync auto à publish/archive (Content API)
- **Meta Catalog** — sync auto à publish/archive (Graph API)
- **TikTok Catalog** — OAuth Business + sync produits (1 variante = 1 SKU TikTok)
- Tokens OAuth chiffrés AES-GCM at rest
- **API interne** `GET /api/internal/artist-commerce?email=` (auth `INTERNAL_API_SECRET`) — statut boutique (`shop_enabled`) + CA net (Σ `totalCents` − remboursements des commandes PAID/SHIPPED/DELIVERED), agrégé sur **toutes** les boutiques du compte (propre + memberships + label). Consommé par le CRM pour la fiche client.

---

## Documentation détaillée

| Doc | Contenu |
|---|---|
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | **Journal des évolutions** (sécurité, facturation/TVA, digital, CRM, devises, NYP, emails) + migrations |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Diagramme système, modèles Prisma, flux d'auth, gating |
| [`docs/PRICING.md`](docs/PRICING.md) | Tiers + add-ons + commissions + matrice de gating |
| [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) | Stripe Connect, GMC, Meta — OAuth flows + webhooks |
| [`docs/multi-currency.md`](docs/multi-currency.md) | Multi-devises : affichage indicatif + Stripe Adaptive Pricing |
| [`docs/SEO.md`](docs/SEO.md) | Pipeline SEO HTML : sitemap, JSON-LD, OG, ISR |
| [`docs/ANALYTICS.md`](docs/ANALYTICS.md) | Tags par shop, Consent Mode, conversion tracking |
| [`docs/ONBOARDING.md`](docs/ONBOARDING.md) | Flow first-time artist, états vides, checklist |
| [`docs/SECURITY.md`](docs/SECURITY.md) | RGPD, secrets, sessions, CSP, rate limiting, isolation app |

FAQ utilisateurs (artistes + fans) : disponible en ligne sur `/aide`.

---

## Déploiement

### Cibles testées
- **Vercel** (recommandé) — Next.js natif, edge runtime pour OG dynamique
- **Railway** — DB Postgres + worker Node, déploiement single-region

### Pré-deploy checklist
1. Vars env complètes (`STRIPE_*`, `GOOGLE_*`, `META_*`, `ENCRYPTION_KEY`, `NEXT_PUBLIC_SHOP_BASE_URL`)
2. `npm run typecheck` → 0 erreur
3. `npm run build` → success
4. Webhook Stripe configuré (endpoint `/api/stripe/webhook`)
5. OAuth redirect URIs configurés côté Google + Meta (URLs prod, pas localhost)
6. Domaine custom DNS pointant vers le déploiement
7. SSL actif + HSTS header (déjà dans `next.config.ts`)
8. DB de prod migrée (`npx prisma migrate deploy`)

### Post-deploy
1. Soumettre `https://shop.band.stream/sitemap.xml` à Google Search Console
2. Vérifier validation Schema sur https://search.google.com/test/rich-results
3. Smoke test : créer un compte test, ouvrir une boutique, publier un produit, faire un achat Stripe en mode test, vérifier sync GMC + Meta
4. Lighthouse SEO ≥ 95

---

## Sécurité & RGPD

- **Secrets** : tous via env. Aucun en dur. Politique de rotation au moindre soupçon de fuite (cf. CLAUDE.md global).
- **Sessions** : tokens hashés SHA-256 en DB, cookies httpOnly + sameSite Lax, TTL 30j.
- **OAuth tokens** : chiffrés AES-GCM avec `ENCRYPTION_KEY`.
- **CSP / Headers** : configurés dans `next.config.ts` (HSTS, X-Frame DENY, Referrer Policy strict-origin).
- **Cookies tiers (analytics)** : Consent Mode v2 default-deny par défaut + bandeau `<CookieBanner>` (cookie 13 mois) qui passe les pixels publicitaires en `granted` à l'opt-in.
- **Isolation app principale** : zéro lecture/écriture sur `bandstream-app/`.

---

## Contribution

Cf. règles globales `CLAUDE.md` du projet parent. En résumé :
- Scope strict : ne jamais modifier `bandstream-app/`
- Aucun secret en dur (rotation immédiate si fuite)
- Typecheck 0 erreur avant tout merge
- Tests Playwright sur les flows critiques (achat, onboarding)

---

## Licence

Propriétaire — BANDSTREAM SAS. Code source non distribué publiquement.
