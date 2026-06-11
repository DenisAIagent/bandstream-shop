import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { slugify } from "@/lib/slugify";

/**
 * Pont SSO depuis l'app principale band.stream (bandstream-app).
 *
 * L'app principale est la source de vérité du plan et de l'add-on Boutique
 * (cf. lib/billing/plan.ts) : elle signe un jeton court (HMAC-SHA256,
 * 60 s) avec le secret partagé SHOP_SSO_SECRET et redirige l'utilisateur
 * ici. On vérifie la signature, on synchronise/crée le ShopArtist
 * correspondant (par email), on ouvre la session boutique (cookie
 * bs_shop_session) et on atterrit sur le backoffice — sans relogin.
 *
 * Les comptes créés via SSO n'ont pas de mot de passe utilisable (hash
 * aléatoire, même principe que les comptes managés par un label) : la
 * connexion directe reste possible via « mot de passe oublié » ou en
 * repassant par l'app principale.
 */

interface SSOPayload {
  email: string;
  name: string;
  plan: "FREE" | "PRO" | "LABEL";
  iat: number;
  exp: number;
}

function verifyToken(token: string, secret: string): SSOPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const provided = Buffer.from(sig, "base64url");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SSOPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    if (typeof payload.email !== "string" || !payload.email.includes("@")) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Plan app principale → Tier boutique (SOLO = valeur historique de Pro). */
function mapTier(plan: SSOPayload["plan"]): "FREE" | "SOLO" | "LABEL" {
  if (plan === "LABEL") return "LABEL";
  if (plan === "PRO") return "SOLO";
  return "FREE";
}

async function ensureUniqueSlug(base: string): Promise<string> {
  const seed = base || "artist";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = attempt === 0 ? seed : `${seed}-${attempt + 1}`;
    const existing = await prisma.shopArtist.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  return `${seed}-${randomBytes(3).toString("hex")}`;
}

export async function GET(req: NextRequest) {
  // Origine réelle vue par le navigateur (le bind -H 0.0.0.0 fausse
  // req.nextUrl.origin en dev) : le cookie de session est posé sur cet
  // hôte, la redirection doit rester dessus.
  const host = req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? (req.nextUrl.protocol === "https:" ? "https" : "http");
  const origin = `${proto}://${host}`;

  const secret = process.env.SHOP_SSO_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "sso_not_configured" }, { status: 503 });
  }

  const token = req.nextUrl.searchParams.get("token") ?? "";
  const payload = verifyToken(token, secret);
  if (!payload) {
    return NextResponse.redirect(new URL("/login?error=sso", origin));
  }

  // FREE n'a jamais accès à la boutique — l'app principale bloque déjà,
  // ceci est la défense en profondeur côté boutique.
  if (payload.plan === "FREE") {
    return NextResponse.redirect(new URL("/login?error=plan", origin));
  }

  const email = payload.email.toLowerCase();
  const tier = mapTier(payload.plan);

  let artist = await prisma.shopArtist.findUnique({ where: { email } });
  if (artist) {
    // Resynchronise plan + add-on depuis la source de vérité.
    artist = await prisma.shopArtist.update({
      where: { id: artist.id },
      data: { tier, shopAddonEnabled: true },
    });
  } else {
    const slug = await ensureUniqueSlug(slugify(payload.name));
    artist = await prisma.shopArtist.create({
      data: {
        email,
        // Hash aléatoire non utilisable : la connexion passe par le SSO.
        passwordHash: randomBytes(48).toString("base64url"),
        artistName: payload.name.slice(0, 80) || slug,
        slug,
        tier,
        countryCode: "FR",
        shopAddonEnabled: true,
      },
    });
  }

  await createSession(artist.id);
  return NextResponse.redirect(new URL("/dashboard", origin));
}
