"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

type ActionResult = { success: true } | { success: false; error: string };

export async function loginArtist(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { success: false, error: "Identifiants invalides" };
  }
  const artist = await prisma.shopArtist.findUnique({ where: { email: parsed.data.email } });
  if (!artist) {
    return { success: false, error: "Identifiants invalides" };
  }
  if (artist.status === "SUSPENDED" || artist.status === "CLOSED") {
    return { success: false, error: "Compte indisponible. Contacte le support." };
  }
  const ok = await verifyPassword(parsed.data.password, artist.passwordHash);
  if (!ok) {
    return { success: false, error: "Identifiants invalides" };
  }
  await createSession(artist.id);
  return { success: true };
}
