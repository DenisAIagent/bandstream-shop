import { getStripe } from "./client";

export async function refundOrder(params: {
  paymentIntentId: string;
  amountCents: number;
}) {
  const stripe = getStripe();
  return stripe.refunds.create({
    payment_intent: params.paymentIntentId,
    amount: params.amountCents,
    refund_application_fee: true,
    reverse_transfer: true,
    metadata: { source: "bs_shop_artist_action" },
  });
}
