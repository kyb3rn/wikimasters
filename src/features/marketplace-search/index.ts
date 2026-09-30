import { h } from 'preact';
import { childController } from '@/core/async';
import { watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { SearchButton, trackListHold } from '@/services/list-search';
import {
  findMarketplaceFilters,
  findMarketplaceLoadMore,
  findMarketplaceRefresh,
  isMarketplaceAppend,
  MARKETPLACE_ROUTE,
  marketplaceList,
  readMarketplaceChoice,
} from '@/site/marketplace';
import { lockControl, unlockAll } from '@/ui/lock';
import { mountUi, type MountedUi } from '@/ui/mount';
import { toast } from '@/ui/toast';

const OWNER = 'marketplace-search';

/**
 * Comme la recherche de la Collection : un changement de tri ou de raretés reçoit la liste déjà affichée
 * (sa première page) ; notre bouton au bout de la ligne appelle l'actualisation de la page, qui charge avec
 * les choix tels qu'ils sont (loupe s'ils ont changé, roue pendant le chargement : le site n'en montre
 * aucune). Tant qu'une recherche attend, « Charger la suite » est verrouillé : il ajouterait la suite des
 * nouveaux filtres à la liste des anciens.
 */
export const marketplaceSearch: Feature = {
  id: 'marketplace-search',
  name: 'Recherche',
  toggleLabel: 'Empêcher le rechargement automatique',
  description: 'Changer de tri ou de raretés ne relance pas la recherche : un bouton la lance, puis recharge la liste.',
  category: 'Marché',
  routes: [MARKETPLACE_ROUTE],
  async mount(ctx) {
    const { signal, log } = ctx;
    let placed: { ui: MountedUi; controller: AbortController } | undefined;

    const hold = trackListHold({
      source: marketplaceList,
      signal,
      log,
      canReload: () => findMarketplaceRefresh() !== undefined,
      appends: isMarketplaceAppend,
      currentChoice: () => {
        const filters = findMarketplaceFilters();
        return filters && readMarketplaceChoice(filters);
      },
      onChange: () => sync(),
    });

    function run(): void {
      if (hold.status() === 'loading') return;
      const refresh = findMarketplaceRefresh();
      if (!refresh) {
        log.warn('actualisation de la page introuvable');
        toast.error("La recherche n'a pas pu être lancée. Rechargez la page.", { title: 'Recherche' });
        return;
      }
      try {
        Promise.resolve(refresh()).catch((error: unknown) => log.debug('actualisation du site en échec', error));
      } catch (error) {
        log.error('actualisation du site en échec', error);
      }
    }

    /** Bouton au bout de la ligne, « Charger la suite » verrouillé tant qu'une recherche attend. Idempotent. */
    function sync(): void {
      if (signal.aborted || !document.body) return;
      const status = hold.status();
      const filters = findMarketplaceFilters();
      if (!filters) {
        placed?.controller.abort();
        placed = undefined;
      } else {
        const vnode = h(SearchButton, { status, onClick: run, name: 'wm-market-search' });
        if (placed?.ui.element.previousElementSibling === filters.sort) {
          placed.ui.update(vnode);
        } else {
          placed?.controller.abort();
          const controller = childController(signal);
          placed = {
            ui: mountUi(vnode, { parent: filters.line, before: filters.sort.nextSibling, inline: true, signal: controller.signal }),
            controller,
          };
        }
      }
      const more = findMarketplaceLoadMore();
      if (more) lockControl(more, { owner: OWNER, locked: status === 'search', reason: "Lancez d'abord la recherche" });
    }

    await whenBody();
    if (signal.aborted) return;
    watchDom(sync, { signal });
    sync();
    ctx.onDispose(() => unlockAll(OWNER));
  },
};
