import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { ShopArtist } from "@prisma/client";

const SESSION_COOKIE = "bs_shop_session";
const SESSION_TTL_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(artistId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.artistSession.create({
    data: { artistId, token: hashToken(token), expiresAt },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.artistSession.deleteMany({ where: { token: hashToken(token) } }).catch(() => {});
    jar.delete(SESSION_COOKIE);
  }
}

export async function getCurrentArtist(): Promise<ShopArtist | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.artistSession.findUnique({
    where: { token: hashToken(token) },
    include: { artist: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.artistSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.artist;
}

export async function requireArtist(): Promise<ShopArtist> {
  const artist = await getCurrentArtist();
  if (!artist) {
    throw new Error("UNAUTHENTICATED");
  }
  return artist;
}
