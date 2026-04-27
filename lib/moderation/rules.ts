// Modération auto basique (UC-12). Bloque les catégories interdites et prix aberrants.
// Évolutif : V1.1 ajoutera modération humaine + ML pour images.

const BANNED_CATEGORIES = [
  /\bweapon/i,
  /\bgun\b/i,
  /\bcontrefa/i,
  /\bcounterfeit/i,
  /\bdrug/i,
  /\bcannabis/i,
  /\bporn/i,
  /\bnsfw/i,
  /\btabac/i,
  /\balcoo?l\b/i,
  /\bbillet/i, // tickets pas autorisés en V1
];

const BANNED_TITLE_KEYWORDS = [
  /\bréplique\b/i,
  /\bfake\b/i,
  /\bcrack\b/i,
];

const MIN_PRICE_CENTS = 100; // 1 €
const MAX_PRICE_CENTS = 100_000_00; // 100 000 €

export interface ModerationInput {
  title: string;
  longDesc: string;
  basePriceCents: number;
  category?: string;
}

export class ModerationError extends Error {
  constructor(message: string, public readonly reason: string) {
    super(message);
    this.name = "ModerationError";
  }
}

export function moderateProduct(input: ModerationInput): void {
  if (input.basePriceCents < MIN_PRICE_CENTS) {
    throw new ModerationError("Prix trop bas", "PRICE_TOO_LOW");
  }
  if (input.basePriceCents > MAX_PRICE_CENTS) {
    throw new ModerationError("Prix trop élevé", "PRICE_TOO_HIGH");
  }
  for (const re of BANNED_TITLE_KEYWORDS) {
    if (re.test(input.title)) {
      throw new ModerationError("Titre non autorisé", "BANNED_TITLE");
    }
  }
  const haystack = [input.category ?? "", input.title, input.longDesc].join(" ");
  for (const re of BANNED_CATEGORIES) {
    if (re.test(haystack)) {
      throw new ModerationError("Catégorie interdite sur band.stream", "BANNED_CATEGORY");
    }
  }
}
