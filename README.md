# bandstream-shop

Module e-commerce indépendant de band.stream. Permet aux artistes Pro/Label de vendre du merch physique via Stripe Connect avec sync Google Merchant Center + Meta Catalog.

## Isolation stricte

Ce module est **strictement indépendant** de `bandstream-app`. Aucune écriture ni import de code applicatif n'est autorisé. Seuls les assets de marque (logo, palette, polices) sont copiés en lecture dans `public/brand/`.

Vérification après chaque commit :

```bash
git -C "../bandstream-app" status --porcelain
# doit toujours retourner vide
```

## Stack

- Next.js 15 (App Router) + TypeScript
- Prisma + Postgres (instance dédiée)
- NextAuth (credentials + email magic link)
- Stripe Connect Express (Modèle A : Stripe gère les tarifs utilisateurs)
- Google Merchant Center (Content API for Shopping)
- Meta Catalog (Graph API)
- Tailwind CSS + Radix UI

## Pricing boutique

| Tier | Abonnement | Boutique | Commission |
|------|-----------|----------|-----------|
| Free | 0€/mois | ❌ | — |
| **Pro** | **10€/mois** | ✅ | **3%** par vente |
| Label | 99€/mois | ✅ | 0% par vente |

Gating Pro+ obligatoire à toutes les étapes critiques.

## Démarrage

```bash
cp .env.example .env.local
npm install
npm run prisma:migrate
npm run dev
# http://localhost:3001
```

## Vérifier l'isolation app

```bash
npm run verify:isolation
```

## Structure

```
app/
├── (public)/            # Surface fan
└── (artist)/            # Backoffice artiste (auth + Pro gate)
    └── api/             # Endpoints API
prisma/                  # Schema et migrations
lib/
├── stripe/              # Stripe Connect + Checkout + Webhooks
├── gmc/                 # Google Merchant Center sync
├── meta/                # Meta Catalog sync
├── pricing/             # Commission, tier-gate, breakdown
├── shipping/            # Calcul frais de port
└── moderation/          # Règles modération auto
```
