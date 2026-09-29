import { createLogger } from '@/core/log';
import { net, type NetRequest } from '@/core/net';
import { readDiscard, readStarChange, readTagAdded, readTagRemoved } from '@/site/cards';
import {
  copiesByCard,
  findCarousel,
  isCopiesQuery,
  isPackOpening,
  parseCopies,
  parsePack,
  type Carousel,
  type OwnedCopy,
  type PackCard,
} from '@/site/pulls';

/** Exemplaire d'une carte du paquet : favori et étiquettes suivis au fil des actions de l'utilisateur. */
export interface PackCopy {
  readonly cardId: string;
  readonly starred: boolean;
  readonly tags: number;
}

/** Paquet ouvert sur /pulls, lu dans les réponses du site. */
export interface OpenPack {
  readonly cards: readonly PackCard[];
  /** Id d'exemplaire → exemplaire ; absents tant que le site ne les a pas chargés (paquet PRO). */
  readonly copies: ReadonlyMap<string, PackCopy> | undefined;
  /** Id de carte → exemplaire que le site y associe : celui que défausse ou met en vente sa modale (et nous). */
  readonly chosen: ReadonlyMap<string, string> | undefined;
  /** Positions dans le paquet des cartes défaussées. */
  readonly discarded: ReadonlySet<number>;
  /** Positions dont la défausse (la nôtre) attend la réponse du site. */
  readonly discarding: ReadonlySet<number>;
}

interface MutableCopy {
  readonly cardId: string;
  starred: boolean;
  tags: number;
}

interface State {
  readonly cards: readonly PackCard[];
  copies: Map<string, MutableCopy> | undefined;
  chosen: Map<string, string> | undefined;
  readonly discarded: Set<number>;
  readonly discarding: Set<number>;
}

const log = createLogger('paquet');
const listeners = new Set<() => void>();
let pack: State | undefined;
let started = false;

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      log.error('abonné en échec', error);
    }
  }
}

function withCopies(state: State, copies: readonly OwnedCopy[]): void {
  state.copies = new Map(copies.map((copy) => [copy.id, { cardId: copy.cardId, starred: copy.starred, tags: copy.tags }]));
  state.chosen = copiesByCard(state.cards, copies);
}

function discard(state: State, userCardId: string): void {
  state.cards.forEach((card, index) => {
    if (state.chosen?.get(card.id) === userCardId) state.discarded.add(index);
  });
}

/** Observe une action du site réussie (lue par `read`) sur le paquet suivi. */
function onAction<T>(read: (request: NetRequest) => T | undefined, apply: (value: T, state: State) => void): void {
  net.observe(
    (request) => read(request) !== undefined,
    (exchange) => {
      const value = read(exchange.request);
      if (!exchange.ok || value === undefined || !pack) return;
      apply(value, pack);
      notify();
    },
  );
}

/**
 * Démarre le suivi du paquet ouvert (une fois pour tout le script ; sans effet ensuite). Le paquet est
 * gardé jusqu'à l'ouverture du suivant : un changement de réglages qui remonte une fonctionnalité ne le
 * perd pas.
 */
export function trackPack(): void {
  if (started) return;
  started = true;
  net.observe(isPackOpening, async (exchange) => {
    if (!exchange.ok) return;
    const parsed = parsePack(await exchange.json());
    if (!parsed) {
      log.warn("réponse d'ouverture de paquet illisible", exchange.request.url.pathname);
      return;
    }
    const state: State = {
      cards: parsed.cards,
      copies: undefined,
      chosen: undefined,
      discarded: new Set(),
      discarding: new Set(),
    };
    if (parsed.copies) withCopies(state, parsed.copies);
    pack = state;
    notify();
  });
  // Paquet PRO : pas d'exemplaires dans la réponse, le site les demande à Supabase juste après.
  net.observe(isCopiesQuery, async (exchange) => {
    const current = pack;
    if (!exchange.ok || !current || current.copies) return;
    const wanted = exchange.request.url.searchParams.get('card_id') ?? '';
    if (!current.cards.every((card) => wanted.includes(card.id))) return;
    const copies = parseCopies(await exchange.json());
    if (!copies) return;
    withCopies(current, copies);
    notify();
  });
  // Favori, étiquettes et défausses, faits dans la modale du site ou par nous.
  onAction(readStarChange, ({ cardId, starred }, state) => {
    for (const copy of state.copies?.values() ?? []) if (copy.cardId === cardId) copy.starred = starred;
  });
  onAction(readTagAdded, ({ userCardId }, state) => {
    const copy = state.copies?.get(userCardId);
    if (copy) copy.tags++;
  });
  onAction(readTagRemoved, ({ userCardId }, state) => {
    const copy = state.copies?.get(userCardId);
    if (copy) copy.tags = Math.max(0, copy.tags - 1);
  });
  onAction(readDiscard, ({ userCardId }, state) => discard(state, userCardId));
}

export function currentPack(): OpenPack | undefined {
  return pack;
}

/**
 * Exemplaire tout juste défaussé : ses cartes sont marquées sans attendre l'observateur de la requête
 * (appelé une tâche plus tard).
 */
export function markDiscarded(userCardId: string): void {
  if (!pack) return;
  discard(pack, userCardId);
  notify();
}

/** Défausse de la carte `index` partie (`on`) ou revenue : les autres actions sur cette carte attendent. */
export function markDiscarding(target: OpenPack, index: number, on: boolean): void {
  if (!pack || pack !== target) return;
  if (on) pack.discarding.add(index);
  else pack.discarding.delete(index);
  notify();
}

/** Le carrousel de /pulls, s'il montre le paquet suivi. */
export function packCarousel(): { carousel: Carousel; pack: OpenPack } | undefined {
  const carousel = findCarousel();
  if (!carousel || !pack || carousel.dots.length !== pack.cards.length) return undefined;
  return { carousel, pack };
}

/** Prévient à chaque changement du paquet suivi (ouverture, exemplaires chargés, favori, étiquette, défausse). */
export function onPackChange(listener: () => void, options: { signal: AbortSignal }): void {
  if (options.signal.aborted) return;
  listeners.add(listener);
  options.signal.addEventListener('abort', () => listeners.delete(listener), { once: true });
}
