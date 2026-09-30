import { h } from 'preact';
import { childController } from '@/core/async';
import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import { net, type NetRequest } from '@/core/net';
import type { Feature } from '@/core/runtime';
import {
  COLLECTION_ROUTE,
  findCollectionPageSetter,
  findCollectionPaginationBars,
  isCollectionList,
  isPageLoading,
  readCollectionQuery,
  readPageLabel,
  type CollectionPage,
  type CollectionPaginationBar,
} from '@/site/collection';
import { Pagination, type PaginationControl } from '@/ui/controls';
import { lockReason } from '@/ui/lock';
import { mountUi, type MountedUi } from '@/ui/mount';
import { toast } from '@/ui/toast';

const HIDDEN = 'wm-collection-pagination-hidden';

/** Une page demandée dont la liste ne part pas dans ce délai est abandonnée (le site n'a pas suivi). */
const START_TIMEOUT = 2000;

interface Pending {
  /** Page demandée, à partir de 0. */
  readonly index: number;
  /** Barre du site sous laquelle on a cliqué, et quoi : la roue n'est que sur ce bouton. */
  readonly bar: HTMLElement;
  readonly control: PaginationControl;
  readonly timer: number;
  request?: NetRequest;
}

/**
 * Chaque barre de pagination du site est cachée, la nôtre posée juste après elle. Précédente et suivante
 * cliquent les boutons du site ; première, dernière et numéro saisi changent son état `page` (il n'a pas
 * de saut direct). La page visée s'affiche aussitôt ; elle est demandée après un court délai sans autre
 * clic (`Pagination`), puis tout est désactivé jusqu'à la fin de la requête de la liste. Un verrou posé
 * sur les boutons du site (recherche en attente) désactive la nôtre.
 */
export const collectionPagination: Feature = {
  id: 'collection-pagination',
  name: 'Pagination',
  description: 'Première et dernière page, et saut direct à une page.',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    const placed = new Map<HTMLElement, { readonly ui: MountedUi; readonly controller: AbortController }>();
    /** Dernier « Page x / y » du site : il le remplace par « Chargement… » pendant un chargement. */
    let shown: CollectionPage | undefined;
    let pending: Pending | undefined;
    /** Barres du site suivies : le numéro y change en texte seul (hors watchDom). */
    let observed: readonly HTMLElement[] = [];
    const observer = new MutationObserver(() => sync());
    signal.addEventListener(
      'abort',
      () => {
        observer.disconnect();
        if (pending) clearTimeout(pending.timer);
      },
      { once: true },
    );

    net.track(
      (request) => !request.own && isCollectionList(request),
      (request) => {
        const current = pending;
        if (!current || current.request || readCollectionQuery(request.url).page !== current.index) return undefined;
        current.request = request;
        clearTimeout(current.timer);
        return () => {
          if (pending !== current) return;
          pending = undefined;
          sync();
        };
      },
      { signal },
    );

    function go(site: CollectionPaginationBar, page: number, control: PaginationControl): void {
      if (pending || !shown) return;
      const from = shown.page - 1;
      const index = page - 1;
      if (index === from) return;
      const move = moveTo(site, from, index, control);
      if (!move) {
        log.warn('état « page » du site introuvable', { from, index });
        toast.error("Impossible d'aller à cette page. Rechargez la page.", { title: 'Pagination' });
        return;
      }
      const timer = window.setTimeout(() => {
        if (pending?.timer !== timer || pending.request) return;
        log.warn('la page demandée n’a pas été chargée', page);
        pending = undefined;
        sync();
      }, START_TIMEOUT);
      pending = { index, bar: site.bar, control, timer };
      move();
      sync();
    }

    /** Précédente et suivante : les boutons du site eux-mêmes. Un saut : son état `page`, puis le défilement qu'il ferait. */
    function moveTo(site: CollectionPaginationBar, from: number, index: number, control: PaginationControl) {
      if (control === 'previous' && index === from - 1) return () => site.previous.click();
      if (control === 'next' && index === from + 1) return () => site.next.click();
      const setPage = findCollectionPageSetter(site.bar, from);
      if (!setPage) return undefined;
      const frame = site.bar.parentElement;
      return () => {
        setPage(index);
        requestAnimationFrame(() => frame?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      };
    }

    function observe(bars: readonly HTMLElement[]): void {
      if (bars.length === observed.length && bars.every((bar, i) => bar === observed[i])) return;
      observer.disconnect();
      for (const bar of bars) observer.observe(bar, { childList: true, subtree: true, characterData: true });
      observed = bars;
    }

    /** Idempotent : n'écrit dans le DOM que ce qui change. */
    function sync(): void {
      if (signal.aborted || !document.body) return;
      const bars = findCollectionPaginationBars();
      for (const [bar, entry] of placed) {
        if (bars.some((site) => site.bar === bar)) continue;
        entry.controller.abort();
        placed.delete(bar);
      }
      observe(bars.map((site) => site.bar));
      for (const site of bars) shown = readPageLabel(site.label.textContent ?? '') ?? shown;
      // Pas encore de numéro lu : la barre du site reste.
      if (!shown) return;
      const loading = bars.some(isPageLoading);
      for (const site of bars) place(site, shown, loading);
    }

    function place(site: CollectionPaginationBar, page: CollectionPage, loading: boolean): void {
      setClass(site.bar, HIDDEN, true);
      const vnode = h(Pagination, {
        page: pending ? pending.index + 1 : page.page,
        total: page.total,
        busy: pending ? (pending.bar === site.bar ? pending.control : true) : loading,
        lockedReason: lockReason(site.previous) ?? lockReason(site.next),
        onChange: (target, control) => go(site, target, control),
      });
      const entry = placed.get(site.bar);
      if (entry?.ui.element.previousElementSibling === site.bar) {
        entry.ui.update(vnode);
        return;
      }
      entry?.controller.abort();
      const parent = site.bar.parentElement;
      if (!parent) return;
      const controller = childController(signal);
      placed.set(site.bar, { ui: mountUi(vnode, { parent, before: site.bar.nextSibling, signal: controller.signal }), controller });
    }

    await whenBody();
    if (signal.aborted) return;
    injectStyle('collection-pagination', `.${HIDDEN} { display: none !important; }`);
    watchDom(sync, { signal });
    ctx.onDispose(() => {
      for (const site of findCollectionPaginationBars()) setClass(site.bar, HIDDEN, false);
    });
  },
};
