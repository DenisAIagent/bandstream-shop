import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { exchangeMetaCode, persistMetaIntegration } from "@/lib/meta/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const businessId = url.searchParams.get("business_id");
  const catalogId = url.searchParams.get("catalog_id");
  const jar = await cookies();
  const expected = jar.get("bs_meta_state")?.value;
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(new URL("/integrations/meta?error=state", process.env.NEXTAUTH_URL!));
  }
  if (!businessId || !catalogId) {
    return NextResponse.redirect(new URL("/integrations/meta?error=missing_business_or_catalog", process.env.NEXTAUTH_URL!));
  }
  const artist = await getCurrentArtist();
  if (!artist) return NextResponse.redirect(new URL("/login?next=/integrations/meta", process.env.NEXTAUTH_URL!));
  try {
    requirePro(artist);
  } catch {
    return NextResponse.redirect(new URL("/integrations/meta?error=pro_required", process.env.NEXTAUTH_URL!));
  }
  const shop = await prisma.shop.findUnique({ where: { artistId: artist.id } });
  if (!shop) return NextResponse.redirect(new URL("/shop/activate", process.env.NEXTAUTH_URL!));

  try {
    const { accessToken } = await exchangeMetaCode(code);
    await persistMetaIntegration({ shopId: shop.id, businessId, catalogId, accessToken });
  } catch (e) {
    return NextResponse.redirect(
      new URL(`/integrations/meta?error=${encodeURIComponent(e instanceof Error ? e.message : "oauth")}`, process.env.NEXTAUTH_URL!),
    );
  }
  jar.delete("bs_meta_state");
  return NextResponse.redirect(new URL("/integrations/meta?connected=1", process.env.NEXTAUTH_URL!));
}
