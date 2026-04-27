import Stripe from "stripe";
import { getEnv } from "@/lib/env";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const env = getEnv();
  cached = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
    appInfo: {
      name: "bandstream-shop",
      version: "0.1.0",
    },
  });
  return cached;
}
