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
  // Blocs alignés sur les mentions légales de la plateforme smartlink
  // (bandstream-app/content/legal/legal-fr.md) — même société éditrice.
  shareCapital: "1 020,00 €",
  siren: "939 221 438",
  siret: "939 221 438 00012",
  vatNumber: "FR 81939221438",
  apeCode: "73.11Z",
  apeLabel: "Activités des agences de publicité",
  rcs: "Paris",
  registeredAt: "RNE — inscrit le 06/01/2025",
  creationDate: "2025-01-02",
  /// LCEN art. 6-III : directeur de la publication.
  publicationDirector: "Tachfin KHELIL, en qualité de Président de BANDSTREAM SAS",
  dpoEmail: "dpo@band.stream",
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
  /// LCEN art. 6-III : hébergeur (identique à la plateforme smartlink).
  hosting: {
    name: "IONOS SE",
    address: "Elgendorfer Str. 57, 56410 Montabaur, Allemagne",
    phone: "09 70 808 911",
    web: "https://www.ionos.fr",
  },
  /// L612-1 C. conso : médiation de la consommation — même statut que la
  /// plateforme smartlink ; mettre à jour LES DEUX apps à la désignation.
  mediation: {
    designated: false,
    text: "en cours de désignation — cette mention sera mise à jour dès la conclusion de la convention de médiation. En attendant, toute réclamation peut être adressée à contact@band.stream.",
    odrUrl: "https://ec.europa.eu/consumers/odr",
  },
} as const;

export function formatCompanyOneLiner(): string {
  const c = PLATFORM_COMPANY;
  return `${c.legalName} — ${c.legalForm} — SIREN ${c.siren} — RCS ${c.rcs}`;
}
