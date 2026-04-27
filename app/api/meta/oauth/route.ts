import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getCurrentArtist } from "@/lib/auth";
import { requirePro } from "@/lib/pricing/tier-gate";
import { getMetaOAuthUrl } from "@/lib/meta/client";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const artist = await getCurrentArtist();
  if (!artist) return NextResponse.redirect(new URL("/login?next=/integrations/meta", process.env.NEXTAUTH_URL!));
  try {
    requirePro(artist);
  } catch {
    return NextResponse.redirect(new URL("/integrations/meta?error=pro_required", process.env.NEXTAUTH_URL!));
  }
  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("bs_meta_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(getMetaOAuthUrl(state));
}
