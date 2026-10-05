import { h, type VNode } from 'preact';
import { onDataChange } from '@/core/data';
import type { Logger } from '@/core/log';
import { siteErrorText } from '@/site/api';
import type { CardRef } from '@/site/cards';
import { toast } from '@/ui/toast';
import { MARKET_HISTORY_DATA, type MarketEntry } from './cache';
import { ageText, plural } from './format';
import { cachedMarket, cachedMarkets, fetchMarket, isStale, marketNeedsPro, onMarketChange, staleness } from './market';
import { showMarketModal, showProOffer } from './open';
import { marketPrice, PRICE_SALES, type MarketPrice } from './price';
import { PriceButton, type PriceButtonProps, type PriceState } from './PriceButton';

/** Prix moyens des cartes affichées, d'après le cache des ventes, pour une page. */
export interface MarketPrices {
  /** Bouton du prix de la carte ; cache pas encore lu : `undefined` (la lecture part, `onChange` suivra). */
  button(card: CardRef, options?: PriceButtonOptions): VNode<PriceButtonProps> | undefined;
  /** Prix moyen de la carte d'après le cache, même ancien. */
  price(card: CardRef): MarketPrice | undefined;
  /** Ventes de la carte en cache, même anciennes. */
  entry(card: CardRef): MarketEntry | undefined;
  /** Ventes de la carte en cache ? Pas encore lu : `undefined` (la lecture part, `onChange` suivra). */
  cached(card: CardRef): boolean | undefined;
  /**
   * Lit le cache de toutes ces cartes d'un coup (`price` les connaît ensuite, sans attendre leur bouton) ; résolu une
   * fois la lecture faite. Cartes déjà connues : relues quand même (une autre page a pu charger leurs ventes).
   */
  preload(cardIds: readonly string[]): Promise<void>;
}

export interface PriceButtonOptions {
  /** Montant affiché à la place de la moyenne. */
  readonly shown?: number | undefined;
  /** Lignes placées en tête de l'info-bulle (ce que montre `shown`). */
  readonly detail?: string | undefined;
}

export interface TrackPricesOptions {
  readonly signal: AbortSignal;
  readonly log: Logger;
  /** Un prix a changé (cache lu, ventes chargées, demande commencée ou finie) : redessiner. */
  readonly onChange: () => void;
}

function priceTitle(state: PriceState, entry: MarketEntry | null, price: MarketPrice | undefined, card: CardRef): string {
  const noPro = marketNeedsPro();
  if (noPro && !entry) return 'Prix moyen de la carte (PRO)';
  if (state === 'missing' || !entry) return `Charger le prix moyen : ${PRICE_SALES} dernières ventes de la carte dans sa rareté`;
  const scope = card.rarity ? `en ${card.rarity}` : 'toutes raretés';
  const summary = price
    ? price.count > PRICE_SALES
      ? `Moyenne des ${PRICE_SALES} dernières ventes ${scope} (${plural(price.count, 'vente')})`
      : `Moyenne des ${plural(price.count, 'vente')} ${scope}`
    : `Aucune vente ${scope}`;
  const action = state === 'stale' && !noPro ? 'actualiser' : 'historique du marché';
  return `${summary}, chargées ${ageText(entry.fetchedAt)}. Clic : ${action}.`;
}

/**
 * Prix moyens d'une page : chaque carte vue est lue une fois dans le cache, puis suivie (ventes chargées ici, dans
 * l'historique ou par le site). Rien n'est demandé au site sans un clic : ventes absentes ou anciennes, le clic les
 * demande (une fois pour toutes les cartes du même modèle, échec en toast) ; récentes, il ouvre l'historique.
 * Compte sans PRO : rien n'est demandé, les ventes en cache (même anciennes) ouvrent l'historique, sinon l'offre PRO.
 */
export function trackPrices({ signal, log, onChange }: TrackPricesOptions): MarketPrices {
  /** Ventes en cache par carte, lues une fois puis suivies (`null` : aucune). */
  const known = new Map<string, MarketEntry | null>();
  const reading = new Set<string>();
  /** Cartes dont les ventes sont demandées au site. */
  const loading = new Set<string>();
  const changed = () => {
    if (!signal.aborted) onChange();
  };

  function lookup(cardId: string): void {
    if (known.has(cardId) || reading.has(cardId)) return;
    reading.add(cardId);
    void cachedMarket(cardId)
      .catch((error: unknown) => {
        log.warn('cache des ventes illisible', error);
        return undefined;
      })
      .then((entry) => {
        reading.delete(cardId);
        // Une demande au site a pu aboutir pendant la lecture : plus récente que le cache lu.
        if (!known.has(cardId)) known.set(cardId, entry ?? null);
        changed();
      });
  }

  async function load(card: CardRef, stale: boolean): Promise<void> {
    if (loading.has(card.id)) return;
    loading.add(card.id);
    changed();
    try {
      // Le cache prévient (`onMarketChange`) : les cartes du même modèle suivent.
      await fetchMarket(card);
    } catch (error) {
      if (!signal.aborted) toast.error(siteErrorText(error), { title: stale ? 'Prix non actualisé' : 'Prix non chargé' });
    } finally {
      loading.delete(card.id);
      changed();
    }
  }

  function open(card: CardRef, entry: MarketEntry | null, state: PriceState): void {
    const noPro = marketNeedsPro();
    if (entry && (state === 'fresh' || noPro)) showMarketModal(card, entry);
    else if (noPro) showProOffer(card);
    else void load(card, state === 'stale');
  }

  onMarketChange(
    (entry) => {
      known.set(entry.cardId, entry);
      changed();
    },
    { signal },
  );
  // Ventes supprimées ou importées depuis la fenêtre Mémoire (ici ou dans un autre onglet) : tout est relu.
  onDataChange(
    MARKET_HISTORY_DATA,
    () => {
      known.clear();
      changed();
    },
    { signal },
  );

  return {
    button(card, { shown, detail } = {}) {
      lookup(card.id);
      const entry = known.get(card.id);
      if (entry === undefined) return undefined;
      const state: PriceState = !entry ? 'missing' : isStale(entry) ? 'stale' : 'fresh';
      const price = entry ? marketPrice(entry, card.rarity) : undefined;
      const title = priceTitle(state, entry, price, card);
      const noPro = marketNeedsPro();
      return h(PriceButton, {
        state,
        staleness: entry ? staleness(entry) : 0,
        price,
        shown: price ? shown : undefined,
        busy: loading.has(card.id),
        needsPro: noPro && !entry,
        opensHistory: entry !== null && (state === 'fresh' || noPro),
        title: detail ? `${detail}\n${title}` : title,
        onClick: () => open(card, entry, state),
      });
    },
    price(card) {
      const entry = known.get(card.id);
      return entry ? marketPrice(entry, card.rarity) : undefined;
    },
    entry(card) {
      return known.get(card.id) ?? undefined;
    },
    cached(card) {
      lookup(card.id);
      const entry = known.get(card.id);
      return entry === undefined ? undefined : entry !== null;
    },
    async preload(cardIds) {
      let entries: Map<string, MarketEntry>;
      try {
        entries = await cachedMarkets(cardIds);
      } catch (error) {
        log.warn('cache des ventes illisible', error);
        return;
      }
      for (const cardId of cardIds) {
        const entry = entries.get(cardId) ?? null;
        const current = known.get(cardId);
        // Une demande au site a pu aboutir pendant la lecture : plus récente que le cache lu.
        if (current && (!entry || current.fetchedAt > entry.fetchedAt)) continue;
        known.set(cardId, entry);
      }
      changed();
    },
  };
}
