import { isRecord } from '@/core/guards';
import type { NetRequest } from '@/core/net';
import { PRO_DAILY_PATH } from '@/site/api';
import { parseRarity, type Rarity } from '@/site/rarity';

/** Carte d'un paquet ouvert (`POST /api/packs/open` ou `/api/packs/pro-daily`). */
export interface PackCard {
  /** Id de la carte (modèle), pas de l'exemplaire. */
  readonly id: string;
  readonly title: string;
  readonly rarity: Rarity | undefined;
  readonly isShiny: boolean;
}

/** Exemplaire possédé d'une carte du paquet (`owned_copies`, ou table `user_cards`). */
export interface OwnedCopy {
  readonly id: string;
  readonly cardId: string;
  /** Favori : le site le met sur la carte, donc sur tous ses exemplaires. */
  readonly starred: boolean;
  readonly isShiny: boolean;
  /** Nombre d'étiquettes de cet exemplaire. */
  readonly tags: number;
}

export interface Pack {
  readonly cards: readonly PackCard[];
  /** `null` quand la réponse ne les donne pas (paquet PRO) : le site les demande alors à Supabase. */
  readonly copies: readonly OwnedCopy[] | null;
}

/** Ouverture d'un paquet, classique ou PRO du jour. */
export function isPackOpening(request: NetRequest): boolean {
  return request.method === 'POST' && (request.url.pathname === '/api/packs/open' || request.url.pathname === PRO_DAILY_PATH);
}

/** Requête du site qui charge les exemplaires des cartes d'un paquet quand la réponse ne les donnait pas. */
export function isCopiesQuery(request: NetRequest): boolean {
  return (
    request.method === 'GET' &&
    request.url.pathname.endsWith('/rest/v1/user_cards') &&
    (request.url.searchParams.get('card_id') ?? '').startsWith('in.(')
  );
}

export function parsePack(raw: unknown): Pack | undefined {
  if (!isRecord(raw)) return undefined;
  const cards = parseCards(raw.cards);
  if (!cards) return undefined;
  return { cards, copies: parseCopies(raw.owned_copies) ?? null };
}

/** Cartes d'un paquet (réponse d'ouverture, état du carrousel) ; `undefined` si une seule est illisible. */
export function parseCards(raw: unknown): PackCard[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const cards: PackCard[] = [];
  for (const card of raw) {
    if (!isRecord(card) || typeof card.id !== 'string') return undefined;
    cards.push({
      id: card.id,
      title: typeof card.wikipedia_title === 'string' ? card.wikipedia_title : '',
      rarity: parseRarity(card.rarity),
      isShiny: card.is_shiny === true,
    });
  }
  return cards.length > 0 ? cards : undefined;
}

export function parseCopies(raw: unknown): OwnedCopy[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const copies: OwnedCopy[] = [];
  for (const row of raw) {
    if (!isRecord(row) || typeof row.id !== 'string' || typeof row.card_id !== 'string') continue;
    copies.push({
      id: row.id,
      cardId: row.card_id,
      starred: row.starred === true,
      isShiny: row.is_shiny === true,
      tags: countTags(row.user_card_tags),
    });
  }
  return copies;
}

/**
 * Étiquettes d'un exemplaire : `user_card_tags: [{ tag: {…} }]` (forme lue dans le code du site).
 * Toute entrée non vide compte : en cas de doute, on compte l'étiquette (la protection l'emporte).
 */
function countTags(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.filter((entry) => isRecord(entry) && entry.tag !== null).length;
}

/**
 * Exemplaire que le site associe à chaque carte du paquet, donc celui que défausse son bouton
 * « Défausser » : le premier dont l'état shiny est celui de la carte tirée, sinon le premier tout court.
 * Même règle que le code du site (page `/pulls`, relevé le 29/09/2026).
 */
export function copiesByCard(cards: readonly PackCard[], copies: readonly OwnedCopy[]): Map<string, string> {
  const chosen = new Map<string, string>();
  const chosenMatches = new Map<string, boolean>();
  for (const copy of copies) {
    const wantShiny = cards.some((card) => card.id === copy.cardId && card.isShiny);
    const matches = copy.isShiny === wantShiny;
    if (!chosen.has(copy.cardId) || (matches && !chosenMatches.get(copy.cardId))) {
      chosen.set(copy.cardId, copy.id);
      chosenMatches.set(copy.cardId, matches);
    }
  }
  return chosen;
}
