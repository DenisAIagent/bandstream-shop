/**
 * Source unique de vérité pour les informations légales de l'éditeur de la
 * plateforme. Utilisée dans le footer public, les mentions légales, les
 * factures émises automatiquement et les emails transactionnels.
 *
 * Source : Annuaire Entreprises (data.gouv.fr) — SIREN 939 221 438.
 */
export const PLATFORM_COMPANY = {
  legalName: "BANDSTREAM",
  legalForm: "SAS, société par actions simplifiée",
  siren: "939 221 438",
  siret: "939 221 438 00012",
  apeCode: "73.11Z",
  apeLabel: "Activités des agences de publicité",
  rcs: "Paris",
  registeredAt: "RNE — inscrit le 06/01/2025",
  creationDate: "2025-01-02",
  address: {
    street: "60 rue François Ier",
    postalCode: "75008",
    city: "Paris",
    country: "France",
  },
  contact: {
    email: "contact@band.stream",
    web: "https://band.stream",
  },
} as const;

export function formatCompanyOneLiner(): string {
  const c = PLATFORM_COMPANY;
  return `${c.legalName} — ${c.legalForm} — SIREN ${c.siren} — RCS ${c.rcs}`;
}
