import type { ShippingZone } from "@prisma/client";

export interface ShippingQuote {
  zone: ShippingZone;
  shippingCents: number;
  estimatedDays: number;
  carrier: string;
  freeShippingApplied: boolean;
}

export function quoteShipping(params: {
  subtotalCents: number;
  zones: ShippingZone[];
  countryCode: string;
}): ShippingQuote | null {
  const zone = params.zones.find((z) => z.enabled && z.countries.includes(params.countryCode));
  if (!zone) return null;
  const free = zone.freeAboveCents != null && params.subtotalCents >= zone.freeAboveCents;
  return {
    zone,
    shippingCents: free ? 0 : zone.flatRateCents,
    estimatedDays: zone.estimatedDays,
    carrier: zone.carrier,
    freeShippingApplied: free,
  };
}
