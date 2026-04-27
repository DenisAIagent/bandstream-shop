import { getEnv } from "@/lib/env";
import { decryptAtRest, encryptAtRest } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";

const GRAPH = "https://graph.facebook.com/v21.0";

export function getMetaOAuthUrl(state: string): string {
  const env = getEnv();
  if (!env.META_APP_ID || !env.META_OAUTH_REDIRECT_URI) {
    throw new Error("[meta] env missing");
  }
  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: env.META_OAUTH_REDIRECT_URI,
    state,
    scope: "catalog_management,business_management,ads_management,instagram_shopping_tag_products",
    response_type: "code",
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeMetaCode(code: string): Promise<{ accessToken: string }> {
  const env = getEnv();
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", env.META_APP_ID!);
  url.searchParams.set("client_secret", env.META_APP_SECRET!);
  url.searchParams.set("redirect_uri", env.META_OAUTH_REDIRECT_URI!);
  url.searchParams.set("code", code);
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`Meta token exchange failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  // Convert short-lived to long-lived
  const long = new URL(`${GRAPH}/oauth/access_token`);
  long.searchParams.set("grant_type", "fb_exchange_token");
  long.searchParams.set("client_id", env.META_APP_ID!);
  long.searchParams.set("client_secret", env.META_APP_SECRET!);
  long.searchParams.set("fb_exchange_token", json.access_token);
  const r2 = await fetch(long);
  if (!r2.ok) return { accessToken: json.access_token };
  const j2 = (await r2.json()) as { access_token: string };
  return { accessToken: j2.access_token };
}

export async function persistMetaIntegration(params: {
  shopId: string;
  businessId: string;
  catalogId: string;
  accessToken: string;
}) {
  return prisma.metaIntegration.upsert({
    where: { shopId: params.shopId },
    create: {
      shopId: params.shopId,
      businessId: params.businessId,
      catalogId: params.catalogId,
      accessToken: encryptAtRest(params.accessToken),
      status: "ACTIVE",
    },
    update: {
      businessId: params.businessId,
      catalogId: params.catalogId,
      accessToken: encryptAtRest(params.accessToken),
      status: "ACTIVE",
      lastError: null,
    },
  });
}

export async function metaGraphFetch(path: string, init: RequestInit & { token: string }) {
  const url = `${GRAPH}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${init.token}`);
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) throw new Error(`Meta Graph ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getDecryptedToken(shopId: string): Promise<{ token: string; catalogId: string }> {
  const integration = await prisma.metaIntegration.findUnique({ where: { shopId } });
  if (!integration) throw new Error("Meta non connecté");
  return { token: decryptAtRest(integration.accessToken), catalogId: integration.catalogId };
}
