import { formatEur } from "@/lib/pricing/breakdown";

interface OrderForEmail {
  publicNumber: string;
  fanName: string;
  fanEmail: string;
  totalCents: number;
  subtotalCents: number;
  shippingCents: number;
  items: Array<{ titleSnapshot: string; variantSnapshot: string | null; quantity: number; unitPriceCents: number }>;
  shopDisplayName: string;
  shopContactEmail: string;
  carrier?: string | null;
  trackingNumber?: string | null;
}

const wrap = (title: string, body: string) => `<!doctype html>
<html><body style="font-family:Inter,Helvetica,sans-serif;background:#0a0a0a;color:#f5f5f5;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#171717;border:1px solid #262626;border-radius:16px;padding:32px">
    <h1 style="font-family:Georgia,serif;font-size:24px;color:#0ED894;margin:0 0 16px">${title}</h1>
    ${body}
    <hr style="border:none;border-top:1px solid #262626;margin:24px 0" />
    <p style="font-size:12px;color:#737373">band.stream — la boutique merch des artistes indépendants.</p>
  </div>
</body></html>`;

export function fanOrderConfirmation(order: OrderForEmail) {
  const items = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;color:#d4d4d4">${i.quantity} × ${i.titleSnapshot}${i.variantSnapshot ? ` (${i.variantSnapshot})` : ""}</td><td style="text-align:right;color:#fff">${formatEur(i.unitPriceCents * i.quantity)}</td></tr>`,
    )
    .join("");

  return {
    subject: `Commande confirmée · ${order.publicNumber}`,
    html: wrap(
      "Merci pour ta commande !",
      `<p>Salut ${order.fanName},</p>
       <p>Ta commande <strong>${order.publicNumber}</strong> chez <strong>${order.shopDisplayName}</strong> est confirmée. L'artiste prépare ton colis.</p>
       <table style="width:100%;font-size:14px;margin-top:16px">${items}
         <tr><td style="padding-top:12px;color:#a3a3a3">Sous-total</td><td style="text-align:right;color:#fff">${formatEur(order.subtotalCents)}</td></tr>
         <tr><td style="color:#a3a3a3">Livraison</td><td style="text-align:right;color:#fff">${formatEur(order.shippingCents)}</td></tr>
         <tr><td style="padding-top:8px;color:#fff;font-weight:bold">Total</td><td style="text-align:right;color:#0ED894;font-weight:bold">${formatEur(order.totalCents)}</td></tr>
       </table>
       <p style="margin-top:20px;font-size:13px;color:#a3a3a3">Une question ? Réponds à cet email — il arrive directement à ${order.shopContactEmail}.</p>`,
    ),
  };
}

export function artistOrderNotification(order: OrderForEmail) {
  const items = order.items
    .map((i) => `<li>${i.quantity} × ${i.titleSnapshot}${i.variantSnapshot ? ` (${i.variantSnapshot})` : ""}</li>`)
    .join("");
  return {
    subject: `Nouvelle vente · ${order.publicNumber} · ${formatEur(order.totalCents)}`,
    html: wrap(
      "Cha-ching ! Une vente vient de tomber 🔔",
      `<p>Commande <strong>${order.publicNumber}</strong> de <strong>${order.fanName}</strong> (${order.fanEmail}).</p>
       <ul style="color:#d4d4d4">${items}</ul>
       <p style="color:#fff">Total encaissé : <strong>${formatEur(order.totalCents)}</strong></p>
       <p style="color:#a3a3a3;font-size:13px">Connecte-toi à ton dashboard pour préparer l'expédition.</p>`,
    ),
  };
}

export function fanShippedNotification(order: OrderForEmail) {
  return {
    subject: `Ta commande ${order.publicNumber} est en route 🎉`,
    html: wrap(
      "Ton colis vient de partir",
      `<p>Salut ${order.fanName},</p>
       <p>Ta commande <strong>${order.publicNumber}</strong> a été expédiée${order.carrier ? ` via ${order.carrier}` : ""}.</p>
       ${order.trackingNumber ? `<p>Numéro de suivi : <code style="background:#0a0a0a;padding:2px 6px;border-radius:4px;color:#0ED894">${order.trackingNumber}</code></p>` : ""}
       <p style="color:#a3a3a3;font-size:13px">Merci de soutenir ${order.shopDisplayName}.</p>`,
    ),
  };
}

export function fanRefundNotification(order: OrderForEmail, refundedCents: number) {
  return {
    subject: `Remboursement de ${formatEur(refundedCents)} · ${order.publicNumber}`,
    html: wrap(
      "Remboursement effectué",
      `<p>Salut ${order.fanName},</p>
       <p>Un remboursement de <strong>${formatEur(refundedCents)}</strong> a été émis pour ta commande <strong>${order.publicNumber}</strong>.</p>
       <p>Le montant arrivera sur ton moyen de paiement sous 5 à 10 jours ouvrés selon ta banque.</p>
       <p style="color:#a3a3a3;font-size:13px">Pour toute question, contacte ${order.shopContactEmail}.</p>`,
    ),
  };
}
