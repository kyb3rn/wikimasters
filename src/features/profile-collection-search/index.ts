import { h } from 'preact';
import { childController } from '@/core/async';
import { watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { SearchButton, trackListHold } from '@/services/list-search';
import {
  findProfileCollectionFilters,
  findProfileCollectionPaginationBars,
  findProfileCollectionStates,
  profileCollectionList,
  readProfileCollectionChoice,
  reloadProfileCollection,
} from '@/site/profile';
import { lockControl, unlockAll } from '@/ui/lock';
import { mountUi, type MountedUi } from '@/ui/mount';
import { toast } from '@/ui/toast';

const OWNER = 'profile-collection-search';

/**
 * Comme la recherche de la Collection : un changement de tri, d'étiquette ou de raretés reçoit la liste déjà
 * affichée ; notre bouton au bout des listes recharge avec les choix tels qu'ils sont (loupe s'ils ont
 * changé, roue pendant le chargement). Tant qu'une recherche attend, la pagination est verrouillée.
 * Revenir sur l'onglet recrée la page aux filtres par défaut : sa première requête part pendant que sa roue
 * remplace les filtres, son état est alors illisible et rien n'est retenu.
 */
export const profileCollectionSearch: Feature = {
  id: 'profile-collection-search',
  name: 'Recherche',
  toggleLabel: 'Empêcher le rechargement automatique',
  description: "Dans la collection d'un ami, changer d'étiquette, de tri ou de raretés ne relance pas la recherche : un bouton la lance, puis recharge la liste.",
  category: 'Profil',
  routes: ['/profile/:name'],
  async mount(ctx) {
    const { signal, log } = ctx;
    let placed: { ui: MountedUi; controller: AbortController } | undefined;

    const hold = trackListHold({
      source: profileCollectionList,
      signal,
      log,
      canReload: () => findProfileCollectionStates() !== undefined,
      currentChoice: () => {
        const filters = findProfileCollectionFilters();
        return filters && readProfileCollectionChoice(filters);
      },
      onChange: () => sync(),
    });

    function run(): void {
      if (hold.status() === 'loading') return;
      if (!reloadProfileCollection()) {
        log.warn('état de la page introuvable');
        toast.error("La recherche n'a pas pu être lancée. Rechargez la page.", { title: 'Recherche' });
      }
    }

    /** Bouton au bout des listes, pagination verrouillée tant qu'une recherche attend. Idempotent. */
    function sync(): void {
      if (signal.aborted || !document.body) return;
      const status = hold.status();
      const filters = findProfileCollectionFilters();
      if (!filters) {
        placed?.controller.abort();
        placed = undefined;
      } else {
        const vnode = h(SearchButton, { status, onClick: run, name: 'wm-pc-search' });
        if (placed?.ui.element.parentElement === filters.lists && placed.ui.element.nextSibling === null) {
          placed.ui.update(vnode);
        } else {
          placed?.controller.abort();
          const controller = childController(signal);
          placed = { ui: mountUi(vnode, { parent: filters.lists, inline: true, signal: controller.signal }), controller };
        }
      }
      for (const bar of findProfileCollectionPaginationBars()) {
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
