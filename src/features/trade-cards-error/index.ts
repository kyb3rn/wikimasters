import { h } from 'preact';
import { classMarks, ROOT_CLASS, watchDom } from '@/core/dom';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { findTradeComposer, reloadTradeCards, tradeCardsSide, type TradeSide } from '@/site/trades';
import { LoadError } from '@/ui/controls';
import { createSlot } from '@/ui/mount';
import { toast } from '@/ui/toast';

const FAILED = 'wm-trade-cards-failed';

// Zone des cartes en échec : seul notre encart reste (ni voile de chargement, ni grille, ni texte du site).
const CSS = `.${FAILED} > :not(.${ROOT_CLASS}) { display: none !important; }`;

const FAILURE = 'Le chargement des cartes a échoué.';
const TIMEOUT = 'La recherche a pris trop de temps. Réessayez, ou précisez les mots-clés.';

interface SideState {
  /** Numéro de la dernière requête partie : seule sa fin compte (le site affiche la dernière réponse reçue). */
  seq: number;
  busy: boolean;
  /** Statut de l'échec (`undefined` : pas de réponse), si la dernière requête a échoué. */
  failure?: { readonly status: number | undefined };
}

const blank = (): Record<TradeSide, SideState> => ({ mine: { seq: 0, busy: false }, theirs: { seq: 0, busy: false } });

/**
 * Cartes d'un côté de la fenêtre d'échange qui n'ont pas pu se charger (réponse en erreur ou pas de réponse,
 * que le site ne montre pas) : à la place de la grille, un encart comme la liste vide du marché, avec
 * « Réessayer », qui relance le chargement tel quel (filtres et page).
 */
export const tradeCardsError: Feature = {
  id: 'trade-cards-error',
  name: 'Erreur de chargement',
  description: "Les cartes d'un échange qui n'ont pas pu se charger se rechargent d'un clic.",
  category: 'Échanges',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    const slot = createSlot(signal);
    const marks = classMarks(signal);
    /** Message du site caché (le nôtre le remplace), rendu quand il n'y a plus d'échec. */
    let hiddenError: HTMLElement | undefined;
    let frame: HTMLElement | undefined;
    let sides = blank();

    function retry(side: TradeSide): void {
      const tab = findTradeComposer()?.tab;
      if (!tab || tab.side !== side || sides[side].busy) return;
      if (!reloadTradeCards(tab)) {
        toast.error("La page n'a pas pu relancer le chargement. Fermez puis rouvrez la fenêtre.", { title: 'Échange' });
        return;
      }
      // Occupé dès le clic : la requête ne part qu'au rendu suivant du site.
      sides[side].busy = true;
      sync();
    }

    function sync(): void {
      const composer = findTradeComposer();
      if (composer?.frame !== frame) {
        frame = composer?.frame;
        sides = blank();
      }
      const tab = composer?.tab;
      const failure = tab && sides[tab.side].failure;
      const area = failure ? tab?.cards : undefined;
      const error = area ? tab?.error : undefined;
      marks.only(FAILED, area ? [area] : []);
      if (hiddenError && hiddenError !== error) ctx.hide(hiddenError, false);
      hiddenError = error;
      if (error) ctx.hide(error);
      if (!tab || !failure || !area) {
        slot.clear();
        return;
      }
      const side = tab.side;
      const vnode = h(LoadError, {
        message: failure.status === 504 ? TIMEOUT : FAILURE,
        busy: sides[side].busy,
        onRetry: () => retry(side),
      });
      slot.render(vnode, { parent: area });
    }

    net.track(
      (request) => {
        const composer = !request.own && findTradeComposer();
        return !!composer && tradeCardsSide(request, composer.friend) !== undefined;
      },
      (request) => {
        const composer = findTradeComposer();
        const side = composer && tradeCardsSide(request, composer.friend);
        if (!composer || !side) return undefined;
        if (composer.frame !== frame) {
          frame = composer.frame;
          sides = blank();
        }
        const state = sides[side];
        const seq = ++state.seq;
        state.busy = true;
        const owner = frame;
        sync();
        return (status) => {
          if (owner !== frame || state.seq !== seq) return;
          state.busy = false;
          state.failure = status === undefined || status >= 400 ? { status } : undefined;
          sync();
        };
      },
      { signal },
    );

    watchDom(sync, { signal });
  },
};
