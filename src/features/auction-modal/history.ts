import { isRecord } from '@/core/guards';
import { parseRarity, type Rarity } from '@/site/rarity';

/** Une mise en vente acceptée par le site. */
export interface SaleRecord {
  /** Date de la mise en vente (ms, horloge du PC) : sert aussi d'identifiant dans l'historique de la carte. */
  readonly at: number;
  readonly price: number;
  /** Durée ; inconnue pour certaines entrées de l'ancien script. */
  readonly minutes: number | undefined;
  /** Rareté de l'exemplaire mis en vente. */
  readonly rarity: Rarity | undefined;
  readonly shiny: boolean;
  readonly auctionId: string | undefined;
}

/** Mises en vente d'une carte (modèle), tous exemplaires confondus, de la plus récente à la plus ancienne. */
export interface CardSales {
  readonly cardId: string;
  readonly title: string;
  readonly records: readonly SaleRecord[];
}

const finite = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

/**
 * Une entrée, au format du script ou à celui de l'ancien wm-vente. L'ancien notait chaque essai avant la réponse du
 * site (`ok` nul tant que l'annonce n'était pas vue) : seuls ceux qu'il a vus publiés comptent. Sa rareté venait du
 * halo de la face (`glow-<rareté>`), d'où « SHINY » pour une L shiny ; sa durée, `duration: { secs, text }`.
 */
function parseRecord(raw: unknown): SaleRecord | undefined {
  if (!isRecord(raw) || ('ok' in raw && raw.ok !== true)) return undefined;
  const at = finite(raw.at);
  const price = finite(raw.price);
  if (at === undefined || price === undefined) return undefined;
  const legacyShiny = typeof raw.rarity === 'string' && raw.rarity.toUpperCase() === 'SHINY';
  const seconds = isRecord(raw.duration) ? finite(raw.duration.secs) : undefined;
  return {
    at,
    price,
    minutes: finite(raw.minutes) ?? (seconds === undefined ? undefined : Math.round(seconds / 60)),
    rarity: legacyShiny ? 'L' : parseRarity(raw.rarity),
    shiny: legacyShiny || raw.shiny === true,
    auctionId: typeof raw.auctionId === 'string' && raw.auctionId !== '' ? raw.auctionId : undefined,
  };
}

/** Enregistrement du magasin `listings` : `{ id: <carte>, title, attempts: [mise en vente] }` (nom de l'ancien script). */
export function parseCardSales(raw: unknown): CardSales | undefined {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !Array.isArray(raw.attempts)) return undefined;
  return {
    cardId: raw.id,
    title: typeof raw.title === 'string' ? raw.title : '',
    records: raw.attempts.flatMap((attempt) => parseRecord(attempt) ?? []).sort((a, b) => b.at - a.at),
  };
}

export function storedCardSales(sales: CardSales) {
  return {
    id: sales.cardId,
    title: sales.title,
    attempts: sales.records.map(({ at, price, minutes, rarity, shiny, auctionId }) => ({ at, price, minutes, rarity, shiny, auctionId })),
  };
}

/** Une mise en vente de plus (en tête) ; même enchère déjà notée : remplacée. */
export function withRecord(sales: CardSales, record: SaleRecord): CardSales {
  const others = sales.records.filter((known) => record.auctionId === undefined || known.auctionId !== record.auctionId);
  return { ...sales, records: [record, ...others].sort((a, b) => b.at - a.at) };
}

export function withoutRecord(sales: CardSales, at: number): CardSales {
  return { ...sales, records: sales.records.filter((record) => record.at !== at) };
}

/** Même rareté et même état shiny que l'exemplaire. */
export const sameRarity = (record: SaleRecord, rarity: Rarity | undefined, shiny: boolean): boolean =>
  rarity !== undefined && record.rarity === rarity && record.shiny === shiny;

/** Mise en vente à reprendre : la plus récente dans la rareté de l'exemplaire (shiny compris), sinon aucune. */
export function lastInRarity(records: readonly SaleRecord[], rarity: Rarity | undefined, shiny: boolean): SaleRecord | undefined {
  return records.find((record) => sameRarity(record, rarity, shiny));
}

/** Durée comme le site l'écrit : « 10 min », « 1 h », « 2 j ». */
export function durationLabel(minutes: number): string {
  if (minutes >= 2880 && minutes % 1440 === 0) return `${minutes / 1440} j`;
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
}
