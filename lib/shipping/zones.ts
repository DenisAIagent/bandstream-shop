export interface ShippingZoneTemplate {
  name: string;
  countries: string[];
  flatRateCents: number;
  freeAboveCents: number | null;
  estimatedDays: number;
  carrier: string;
}

export const DEFAULT_SHIPPING_ZONES: ShippingZoneTemplate[] = [
  {
    name: "FR_METRO",
    countries: ["FR"],
    flatRateCents: 590,
    freeAboveCents: 8000,
    estimatedDays: 3,
    carrier: "La Poste",
  },
  {
    name: "EU",
    countries: ["BE", "DE", "ES", "IT", "LU", "NL", "PT", "AT", "DK", "FI", "IE", "PL", "SE"],
    flatRateCents: 990,
    freeAboveCents: 15000,
    estimatedDays: 6,
    carrier: "Colissimo International",
  },
  {
    name: "UK_CH",
    countries: ["GB", "CH", "NO"],
    flatRateCents: 1490,
    freeAboveCents: 20000,
    estimatedDays: 8,
    carrier: "Chronopost International",
  },
  {
    name: "US_CA",
    countries: ["US", "CA"],
    flatRateCents: 1990,
    freeAboveCents: 25000,
    estimatedDays: 12,
    carrier: "Chronopost International",
  },
];

export function findZoneForCountry(zones: { countries: string[]; enabled: boolean }[], country: string) {
  return zones.find((z) => z.enabled && z.countries.includes(country));
}
