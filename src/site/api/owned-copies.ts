import { isRecord } from '@/core/guards';
import { parseRarity, type Rarity } from '@/site/rarity';
import { SiteApiError } from './errors';
import { supabaseRequest, supabaseUserId } from './supabase';

/**
 * Exemplaire possédé lu directement dans Supabase (`user_cards` et sa carte) : ce que la Collection du site montre de
 * lui, aux valeurs de l'exemplaire (`effectiveCardListItem` du site, code du 02/10/2026).
 */
export interface OwnedCopy {
  /** Exemplaire (`user_cards.id`). */
  readonly id: string;
  /** Carte (modèle). */
  readonly cardId: string;
  readonly title: string;
  readonly category: string;
  /** Absente si la carte cache son image (`hide_image` : images sensibles). */
  readonly image: string | undefined;
  /** Rareté de l'exemplaire, celle de son obtention (`snapshot_rarity`), sinon celle de la carte. */
  readonly rarity: Rarity;
  /** Shiny : une L seulement, comme la face du site. */
  readonly shiny: boolean;
  readonly atk: number;
  readonly def: number;
  readonly starred: boolean;
  /** Date d'obtention (ms) ; illisible : 0. */
  readonly obtainedAt: number;
  /**
   * La carte telle que la Collection du site la passe à sa face et à sa modale : celle lue, aux valeurs de
   * l'exemplaire (`id` de la carte, rareté, ATK, DEF, `is_shiny`).
   */
  readonly siteCard: Readonly<Record<string, unknown>>;
}

/** Lignes par requête : le plafond supposé de Supabase (`max-rows`, non vérifié ; la sonde du 30/09 en a reçu 1 459). */
export const OWNED_COPIES_BATCH = 1000;

/** Face (titre, catégorie, image, rareté, ATK, DEF) et modale de carte du site (lien Wikipédia, Q-Score, vues). */
const CARD_COLUMNS = 'wikipedia_title,wikipedia_url,category,image_url,hide_image,rarity,atk,def,q_score,pageviews';

/**
 * Exemplaires sans étiquette du joueur, une tranche : le filtre `user_card_tags=is.null` exige la jointure dans
 * `select`. Ordre fixe (le plus récent d'abord, puis l'identifiant) pour que les tranches se suivent.
 */
export function untaggedCopiesPath(userId: string, offset: number): string {
  const select = `id,card_id,starred,is_shiny,obtained_at,snapshot_rarity,snapshot_atk,snapshot_def,card:cards(${CARD_COLUMNS}),user_card_tags(tag_id)`;
  return (
    `/rest/v1/user_cards?select=${select}&user_id=eq.${encodeURIComponent(userId)}&user_card_tags=is.null` +
    `&order=obtained_at.desc,id.desc&limit=${OWNED_COPIES_BATCH}&offset=${offset}`
  );
}

const numberOr = (...values: unknown[]): number => {
  for (const value of values) if (typeof value === 'number' && Number.isFinite(value)) return value;
  return 0;
};

/** Une ligne de `untaggedCopiesPath` ; illisible (sans carte, sans rareté) : `undefined`. */
export function parseOwnedCopy(raw: unknown): OwnedCopy | undefined {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.card_id !== 'string') return undefined;
  const card = Array.isArray(raw.card) ? (raw.card as unknown[])[0] : raw.card;
  if (!isRecord(card) || typeof card.wikipedia_title !== 'string') return undefined;
  const rarity = parseRarity(raw.snapshot_rarity) ?? parseRarity(card.rarity);
  if (!rarity) return undefined;
  const obtainedAt = typeof raw.obtained_at === 'string' ? Date.parse(raw.obtained_at) : NaN;
  const atk = numberOr(raw.snapshot_atk, card.atk);
  const def = numberOr(raw.snapshot_def, card.def);
  return {
    id: raw.id,
    cardId: raw.card_id,
    title: card.wikipedia_title.trim(),
    category: typeof card.category === 'string' ? card.category : '',
    image: card.hide_image !== true && typeof card.image_url === 'string' && card.image_url !== '' ? card.image_url : undefined,
    rarity,
    shiny: raw.is_shiny === true && rarity === 'L',
    atk,
    def,
    starred: raw.starred === true,
    obtainedAt: Number.isFinite(obtainedAt) ? obtainedAt : 0,
    siteCard: { ...card, id: raw.card_id, rarity, atk, def, is_shiny: raw.is_shiny === true },
  };
}

/**
 * Favori d'un exemplaire, comme la Collection du site (`update({ starred }).eq('id', exemplaire)` de son client
 * Supabase, code du 02/10/2026). Une tentative.
 */
export async function setCopyStarred(userCardId: string, starred: boolean): Promise<void> {
  await supabaseRequest(
    `/rest/v1/user_cards?id=eq.${encodeURIComponent(userCardId)}`,
    { method: 'PATCH', body: JSON.stringify({ starred }) },
    'Favori non changé',
    () => true,
  );
}

export interface OwnedCopies {
  readonly copies: readonly OwnedCopy[];
  /** Lignes illisibles, laissées de côté. */
  readonly skipped: number;
}

/**
 * Tous les exemplaires sans étiquette du joueur, par tranches jusqu'à une tranche incomplète : une requête en
 * pratique, complète dans tous les cas. Une tentative par tranche, comme toute requête du script.
 */
export async function fetchUntaggedCopies(): Promise<OwnedCopies> {
  const userId = supabaseUserId();
  if (!userId) throw new SiteApiError('Session du site introuvable : rechargez la page.', 0);
  const copies: OwnedCopy[] = [];
  let skipped = 0;
  for (let offset = 0; ; offset += OWNED_COPIES_BATCH) {
    const rows = await supabaseRequest(untaggedCopiesPath(userId, offset), {}, 'Cartes illisibles', (raw) =>
      Array.isArray(raw) ? (raw as unknown[]) : undefined,
    );
    for (const row of rows) {
      const copy = parseOwnedCopy(row);
      if (copy) copies.push(copy);
      else skipped++;
    }
    if (rows.length < OWNED_COPIES_BATCH) return { copies, skipped };
  }
}
