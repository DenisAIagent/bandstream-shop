"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentFan, destroyFanSession } from "@/lib/fan-auth";

/**
 * Droit à l'effacement (RGPD art. 17) — exercé depuis « Mon compte »
 * (identité vérifiée par magic-link email).
 *
 * Anonymisation plutôt que suppression pour les commandes : les montants,
 * identifiants Stripe et factures sont conservés (obligations comptables,
 * art. 17.3.b — L123-22 C. com.), mais toutes les données identifiantes
 * sont écrasées : email, nom, adresses de livraison/facturation.
 * Sont supprimés : avis (ou anonymisés), liens de téléchargement, paniers
 * abandonnés, compte fan et sessions.
 */
export async function eraseFanDataAction(formData: FormData): Promise<void> {
  const fan = await getCurrentFan();
  if (!fan) redirect("/account/login?next=/account");

  if (formData.get("confirm") !== "on") {
    redirect("/account?erase=confirm_required");
  }

  const anonymizedEmail = `anonyme-${fan.id.slice(0, 8)}@rgpd.invalid`;

  await prisma.$transaction([
    // Commandes : PII écrasée, trace comptable conservée.
    prisma.order.updateMany({
      where: { fanEmail: fan.email },
      data: {
        fanEmail: anonymizedEmail,
        fanName: "Acheteur anonymisé",
        shippingAddress: Prisma.JsonNull,
        billingAddress: Prisma.JsonNull,
        marketingOptIn: false,
      },
    }),
    // Avis publics : le texte reste (contenu de la boutique), l'identité part.
    prisma.productReview.updateMany({
      where: { authorEmail: fan.email },
      data: { authorName: "Anonyme", authorEmail: null },
    }),
    // Accès digitaux et relances : supprimés (l'email disparaît).
    prisma.downloadGrant.deleteMany({ where: { fanEmail: fan.email } }),
    prisma.abandonedCart.deleteMany({ where: { fanEmail: fan.email } }),
    // Compte fan : suppression (sessions en cascade).
    prisma.fan.delete({ where: { id: fan.id } }),
  ]);

  await destroyFanSession();
  redirect("/?data=erased");
}
