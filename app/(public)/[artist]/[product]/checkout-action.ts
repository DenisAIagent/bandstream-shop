"use server";

import { z } from "zod";
import { startCheckoutForVariant } from "@/lib/stripe/checkout";

const schema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid(),
  country: z.string().length(2),
  fanEmail: z.string().email(),
  fanName: z.string().min(2).max(120),
  shopSlug: z.string().min(1),
});

type Result = { success: true; url: string } | { success: false; error: string };

export async function startCheckoutAction(input: z.infer<typeof schema>): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  try {
    const url = await startCheckoutForVariant(parsed.data);
    return { success: true, url };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Checkout impossible" };
  }
}
