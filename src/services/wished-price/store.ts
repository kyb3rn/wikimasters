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

const STORE_KEY = 'wm-wished-prices-v1';
/** À signaler pour le futur import / export des réglages, qui devra peut-être l'inclure. */
const store = /* @__PURE__ */ jsonStore<WishedPrices>(STORE_KEY, {}, parseWishedPrices);

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
  const next = store.update((current) => {
    const prices: Record<string, WishedPrice> = { ...current };
    if (price === undefined) delete prices[key];
    else prices[key] = { price, at: Date.now(), title: card.title };
    return prices;
  });
  cached = next;
  changes.emit();
}

/** Prévenu de tout changement des prix souhaités, ici ou dans un autre onglet. */
export function onWishedPricesChange(listener: () => void, options: { signal: AbortSignal }): void {
  if (!watching) {
    watching = true;
    window.addEventListener('storage', (event) => {
      if (event.key !== STORE_KEY && event.key !== null) return;
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
