import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { exchangeCodeForTokens, persistRefreshToken } from "@/lib/gmc/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const merchantId = url.searchParams.get("merchant_id") ?? url.searchParams.get("merchantId");
  const jar = await cookies();
  const expected = jar.get("bs_gmc_state")?.value;
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(new URL("/integrations/gmc?error=state", process.env.NEXTAUTH_URL!));
  }
  const artist = await getCurrentArtist();
  if (!artist) return NextResponse.redirect(new URL("/login?next=/integrations/gmc", process.env.NEXTAUTH_URL!));
  try {
    requirePro(artist);
  } catch {
    return NextResponse.redirect(new URL("/integrations/gmc?error=pro_required", process.env.NEXTAUTH_URL!));
  }
  const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
  if (!shop) return NextResponse.redirect(new URL("/shop/activate", process.env.NEXTAUTH_URL!));

  if (!merchantId) {
    return NextResponse.redirect(new URL("/integrations/gmc?error=missing_merchant_id", process.env.NEXTAUTH_URL!));
  }

  try {
    const { refreshToken } = await exchangeCodeForTokens(code);
    await persistRefreshToken(shop.id, merchantId, refreshToken);
  } catch (e) {
    return NextResponse.redirect(
      new URL(`/integrations/gmc?error=${encodeURIComponent(e instanceof Error ? e.message : "oauth")}`, process.env.NEXTAUTH_URL!),
    );
  }
  jar.delete("bs_gmc_state");
  return NextResponse.redirect(new URL("/integrations/gmc?connected=1", process.env.NEXTAUTH_URL!));
}
