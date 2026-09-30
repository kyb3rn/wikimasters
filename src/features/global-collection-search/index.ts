import { h } from 'preact';
import { childController } from '@/core/async';
import { watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { SearchButton, trackListHold } from '@/services/list-search';
import {
  findGlobalCollectionFilters,
  findGlobalCollectionPaginationBars,
  findGlobalCollectionStates,
  forgetGlobalCollectionPages,
  GLOBAL_COLLECTION_ROUTE,
  globalCollectionList,
  readGlobalCollectionChoice,
  reloadGlobalCollection,
} from '@/site/global-collection';
import { lockControl, unlockAll } from '@/ui/lock';
import { mountUi, type MountedUi } from '@/ui/mount';
import { toast } from '@/ui/toast';

const OWNER = 'global-collection-search';

/**
 * Comme la recherche de la Collection : un changement de tri, de raretés ou de liste de souhaits reçoit la
 * liste déjà affichée ; notre bouton au bout de la ligne recharge avec les choix tels qu'ils sont (loupe s'ils
 * ont changé, roue pendant le chargement). Tant qu'une recherche attend, la pagination est verrouillée.
 * Les pages que le site garde dans l'onglet sont oubliées : sans quoi un changement s'afficherait sans
 * requête, et une liste resservie resterait gardée sous d'autres filtres que les siens.
 */
export const globalCollectionSearch: Feature = {
  id: 'global-collection-search',
  name: 'Recherche',
  toggleLabel: 'Empêcher le rechargement automatique',
  description: 'Changer de tri, de raretés ou de liste de souhaits ne relance pas la recherche : un bouton la lance, puis recharge la liste.',
  category: 'Toutes les cartes',
  routes: [GLOBAL_COLLECTION_ROUTE],
  async mount(ctx) {
    const { signal, log } = ctx;
    let placed: { ui: MountedUi; controller: AbortController } | undefined;

    /** Tout de suite, puis une fois que le site a gardé la réponse qu'il vient de recevoir. */
    function forgetPages(): void {
      forgetGlobalCollectionPages();
      for (const delay of [0, 500]) {
        window.setTimeout(() => {
          if (!signal.aborted) forgetGlobalCollectionPages();
        }, delay);
      }
    }
    forgetGlobalCollectionPages();

    const hold = trackListHold({
      source: globalCollectionList,
      signal,
      log,
      canReload: () => findGlobalCollectionStates() !== undefined,
      currentChoice: () => {
        const filters = findGlobalCollectionFilters();
        return filters && readGlobalCollectionChoice(filters);
      },
      onChange: () => sync(),
      onHeld: forgetPages,
      onShown: forgetPages,
    });

    function run(): void {
      if (hold.status() === 'loading') return;
      forgetGlobalCollectionPages();
      if (!reloadGlobalCollection()) {
        log.warn('état de la page introuvable');
        toast.error("La recherche n'a pas pu être lancée. Rechargez la page.", { title: 'Recherche' });
      }
    }

    /** Bouton au bout de la ligne, pagination verrouillée tant qu'une recherche attend. Idempotent. */
    function sync(): void {
      if (signal.aborted || !document.body) return;
      const status = hold.status();
      const filters = findGlobalCollectionFilters();
      if (!filters) {
        placed?.controller.abort();
        placed = undefined;
      } else {
        const vnode = h(SearchButton, { status, onClick: run, name: 'wm-gc-search' });
        if (placed?.ui.element.previousElementSibling === filters.sortBox) {
          placed.ui.update(vnode);
        } else {
          placed?.controller.abort();
          const controller = childController(signal);
          placed = {
            ui: mountUi(vnode, { parent: filters.line, before: filters.sortBox.nextSibling, inline: true, signal: controller.signal }),
            controller,
          };
        }
      }
      for (const bar of findGlobalCollectionPaginationBars()) {
        for (const button of [bar.previous, bar.next]) {
          lockControl(button, { owner: OWNER, locked: status === 'search', reason: "Lancez d'abord la recherche" });
        }
      }
    }

    await whenBody();
    if (signal.aborted) return;
    watchDom(sync, { signal });
    sync();
    ctx.onDispose(() => unlockAll(OWNER));
  },
};
