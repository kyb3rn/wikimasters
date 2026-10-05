import { tally, type ImportCounts, type MergeOutcome } from '@/core/data';
import { isRecord } from '@/core/guards';
import { createListeners } from '@/core/listeners';
import { createLogger } from '@/core/log';
import { jsonStore } from '@/core/storage';
import type { Rarity } from '@/site/rarity';

/*
 * Prix souhaité d'une carte (demande de l'utilisateur, page Revente ; version de dev seulement) : le prix qu'il veut
 * en tirer, fixé par lui, par carte ET par rareté de l'exemplaire, la L shiny à part. Aucun par défaut ; gardé après la
 * vente. Un exemplaire revenu d'une enchère invendue dans une autre rareté n'a donc plus le sien (accepté).
 */

/** Ce qui désigne un prix souhaité : la carte (modèle) et la rareté de l'exemplaire. */
export interface WishedPriceCard {
  readonly cardId: string;
  readonly title: string;
  readonly rarity: Rarity;
  /** Shiny (une L seulement, comme la face du site). */
  readonly shiny: boolean;
}

export interface WishedPrice {
  /** Wikibidous, entier positif. */
  readonly price: number;
  /** Date de l'enregistrement (ms). */
  readonly at: number;
  /** Titre de la carte à l'enregistrement (lisibilité du stockage et du futur export). */
  readonly title: string;
}

type WishedPrices = Readonly<Record<string, WishedPrice>>;

/** Plus grand prix accepté. */
export const WISHED_PRICE_MAX = 10_000_000;

export const wishedPriceKey = ({ cardId, rarity, shiny }: WishedPriceCard): string => `${cardId}:${rarity}${shiny ? ':shiny' : ''}`;

export const isWishedPriceValue = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= WISHED_PRICE_MAX;

/** Stockage relu : entrées illisibles écartées une à une. */
export function parseWishedPrices(raw: unknown): WishedPrices | undefined {
  if (!isRecord(raw)) return undefined;
  const prices: Record<string, WishedPrice> = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (!isRecord(entry) || !isWishedPriceValue(entry.price)) continue;
    prices[key] = {
      price: entry.price,
      at: typeof entry.at === 'number' ? entry.at : 0,
      title: typeof entry.title === 'string' ? entry.title : '',
    };
  }
  return prices;
}

export const WISHED_PRICES_KEY = 'wm-wished-prices-v1';
const store = /* @__PURE__ */ jsonStore<WishedPrices>(WISHED_PRICES_KEY, {}, parseWishedPrices);

const log = /* @__PURE__ */ createLogger('prix souhaité');
const changes = /* @__PURE__ */ createListeners(log, 'écouteur des prix souhaités');
/** Lu une fois, puis à chaque changement (ici ou dans un autre onglet) : relu sans cesse, le JSON coûterait. */
let cached: WishedPrices | undefined;
let watching = false;

function all(): WishedPrices {
  cached ??= store.get();
  return cached;
}

export function wishedPrice(card: WishedPriceCard): WishedPrice | undefined {
  return all()[wishedPriceKey(card)];
}

/** Enregistre le prix souhaité de la carte dans cette rareté, ou le retire (`undefined`). */
export function setWishedPrice(card: WishedPriceCard, price: number | undefined): void {
  const key = wishedPriceKey(card);
  const prices: Record<string, WishedPrice> = { ...store.get() };
  if (price === undefined) delete prices[key];
  else prices[key] = { price, at: Date.now(), title: card.title };
  write(prices);
}

/** Tous les prix souhaités, par clé (`wishedPriceKey`). */
export function allWishedPrices(): WishedPrices {
  return all();
}

function write(next: WishedPrices): void {
  store.set(next);
  cached = next;
  changes.emit();
}

/** Retire ces prix souhaités (clés de `wishedPriceKey`). */
export function removeWishedPrices(keys: readonly string[]): void {
  const gone = new Set(keys);
  write(Object.fromEntries(Object.entries(all()).filter(([key]) => !gone.has(key))));
}

/**
 * Prix souhaités d'un autre navigateur fusionnés avec ceux d'ici : absent ici, ajouté ; présent des deux côtés, le plus
 * récemment fixé l'emporte (à égalité, celui d'ici).
 */
export function mergeWishedPrices(local: WishedPrices, incoming: WishedPrices): { readonly result: WishedPrices; readonly outcomes: readonly MergeOutcome[] } {
  const result: Record<string, WishedPrice> = { ...local };
  const outcomes = Object.entries(incoming).map(([key, entry]): MergeOutcome => {
    const known = local[key];
    if (known && entry.at <= known.at) return 'unchanged';
    result[key] = entry;
    if (!known) return 'added';
    return known.price === entry.price ? 'unchanged' : 'updated';
  });
  return { result, outcomes };
}

/** Prix souhaités d'un fichier d'export fusionnés avec ceux d'ici (`apply` faux : comptés seulement). */
export function importWishedPrices(raw: unknown, apply: boolean): ImportCounts | undefined {
  const incoming = parseWishedPrices(raw);
  if (!incoming || !isRecord(raw)) return undefined;
  const { result, outcomes } = mergeWishedPrices(all(), incoming);
  if (apply && outcomes.some((outcome) => outcome !== 'unchanged')) write(result);
  return tally(outcomes, Object.keys(raw).length - Object.keys(incoming).length);
}

/** Prévenu de tout changement des prix souhaités, ici ou dans un autre onglet. */
export function onWishedPricesChange(listener: () => void, options: { signal: AbortSignal }): void {
  if (!watching) {
    watching = true;
    window.addEventListener('storage', (event) => {
      if (event.key !== WISHED_PRICES_KEY && event.key !== null) return;
      cached = undefined;
      changes.emit();
    });
  }
  changes.on(listener, options);
}

/** Fonctionnalités qui veulent le prix souhaité dans la mise en vente (réglage de l'onglet Enchères). */
let saleViewers = 0;

/** Affiche le prix souhaité dans la mise en vente jusqu'à l'interruption de `signal`. */
export function showWishedPriceInSale(signal: AbortSignal): void {
  if (signal.aborted) return;
  saleViewers++;
  changes.emit();
  signal.addEventListener(
    'abort',
    () => {
      saleViewers--;
      changes.emit();
    },
    { once: true },
  );
}

export const shownInSale = (): boolean => saleViewers > 0;
