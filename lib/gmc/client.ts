import { google, type content_v2_1 } from "googleapis";
import { getEnv } from "@/lib/env";
import { decryptAtRest, encryptAtRest } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";

const SCOPE = ["https://www.googleapis.com/auth/content"];

export function getOAuthClient() {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_OAUTH_REDIRECT_URI) {
    throw new Error("[gmc] Google OAuth env vars missing");
  }
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_OAUTH_REDIRECT_URI);
}

export function getOAuthUrl(state: string): string {
  return getOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPE,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google a renvoyé un token sans refresh — réessaie en révoquant l'accès puis re-consentant.");
  }
  return { refreshToken: tokens.refresh_token };
}

export async function getContentClient(shopId: string): Promise<content_v2_1.Content> {
  const integration = await prisma.gmcIntegration.findUnique({ where: { shopId } });
  if (!integration) throw new Error("GMC non connecté pour cette boutique");
  const refreshToken = decryptAtRest(integration.refreshToken);
  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: refreshToken });
  return google.content({ version: "v2.1", auth });
}

export async function persistRefreshToken(shopId: string, merchantId: string, refreshToken: string) {
  const enc = encryptAtRest(refreshToken);
  return prisma.gmcIntegration.upsert({
    where: { shopId },
    create: { shopId, merchantId, refreshToken: enc, status: "ACTIVE" },
    update: { merchantId, refreshToken: enc, status: "ACTIVE", lastError: null },
  });
}
