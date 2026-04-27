"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";
import { slugify } from "@/lib/slugify";

const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  artistName: z.string().min(2).max(80),
  countryCode: z.string().length(2).toUpperCase(),
  password: z.string().min(12).max(200),
  acceptTerms: z.literal("on"),
});

type ActionResult =
  | { success: true; artistId: string }
  | { success: false; error: string };

export async function registerArtist(formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    artistName: formData.get("artistName"),
    countryCode: formData.get("countryCode"),
    password: formData.get("password"),
    acceptTerms: formData.get("acceptTerms"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const baseSlug = slugify(parsed.data.artistName);
    const slug = await ensureUniqueSlug(baseSlug);

    const artist = await prisma.shopArtist.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        artistName: parsed.data.artistName,
        slug,
        tier: "PRO", // V1 : seul Pro est créable depuis ce module isolé
        countryCode: parsed.data.countryCode,
      },
    });

    await createSession(artist.id);
    return { success: true, artistId: artist.id };
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, error: "Email déjà utilisé" };
    }
    return { success: false, error: "Création impossible. Réessaie dans un instant." };
  }
}

async function ensureUniqueSlug(base: string): Promise<string> {
  const seed = base || "artist";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = attempt === 0 ? seed : `${seed}-${attempt + 1}`;
    const exists = await prisma.shopArtist.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
  }
  return `${seed}-${Date.now()}`;
}
