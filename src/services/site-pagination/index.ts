import { h } from 'preact';
import { childController } from '@/core/async';
import { injectStyle, setClass, watchDom } from '@/core/dom';
import type { Logger } from '@/core/log';
import { net, type NetRequest } from '@/core/net';
import { Pagination, type PaginationControl } from '@/ui/controls';
import { lockReason } from '@/ui/lock';
import { mountUi, type MountedUi } from '@/ui/mount';
import { toast } from '@/ui/toast';

/** Barre de pagination du site : « ← Précédent », son libellé (« Page x / y »…), « Suivant → ». */
export interface SitePaginationBar {
  readonly bar: HTMLElement;
  readonly previous: HTMLButtonElement;
  readonly label: HTMLElement;
  readonly next: HTMLButtonElement;
}

export interface PageLabel {
  /** À partir de 1. */
  readonly page: number;
  readonly total?: number;
  /** Sans total : y a-t-il une page suivante. */
  readonly hasNext?: boolean;
}

export interface SitePaginationSource {
  findBars(): SitePaginationBar[];
  /** Libellé de la barre ; rien s'il ne donne pas la page (chargement). */
  readLabel(text: string): PageLabel | undefined;
  isLoading(bars: readonly SitePaginationBar[]): boolean;
  isList(request: NetRequest): boolean;
  /** Page d'une requête de la liste, à partir de 0. */
  readPage(url: URL): number | undefined;
  /** De quoi aller directement à la page `index` depuis `from` (à partir de 0), comme la page le ferait. */
  jump(bar: SitePaginationBar, from: number, index: number): (() => void) | undefined;
  /**
   * La page peut s'afficher sans requête (gardée par le site) : passé ce délai sans requête, la page visée est
   * tenue pour affichée si la barre la montre, hors chargement.
   */
  readonly settleWithoutRequest?: number;
}

export interface SitePaginationOptions {
  readonly signal: AbortSignal;
  readonly log: Logger;
  /** Classe qui cache les barres du site. */
  readonly hiddenClass: string;
}

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
 * Chaque barre de pagination du site est cachée, la nôtre (|< < Page [n] / total > >|) posée juste après elle.
 * Précédente et suivante cliquent les boutons du site ; première, dernière et numéro saisi passent par
 * `jump`. La page visée s'affiche aussitôt ; elle est demandée après un court délai sans autre clic
 * (`Pagination`), puis tout est désactivé jusqu'à la fin de la requête de la liste. Un verrou posé sur les
 * boutons du site (recherche en attente) désactive la nôtre. Idempotent, retiré à l'interruption de `signal`.
 */
export function replaceSitePagination(source: SitePaginationSource, { signal, log, hiddenClass }: SitePaginationOptions): void {
  const placed = new Map<HTMLElement, { readonly ui: MountedUi; readonly controller: AbortController }>();
  /** Dernier libellé lisible du site : il peut le remplacer par « Chargement… » pendant un chargement. */
  let shown: PageLabel | undefined;
  let pending: Pending | undefined;
  /** Barres du site suivies : le numéro peut y changer en texte seul (hors watchDom). */
  let observed: readonly HTMLElement[] = [];
  const observer = new MutationObserver(() => sync());
  signal.addEventListener(
    'abort',
    () => {
      observer.disconnect();
      if (pending) clearTimeout(pending.timer);
      for (const site of source.findBars()) setClass(site.bar, hiddenClass, false);
    },
    { once: true },
  );

  net.track(
    (request) => !request.own && source.isList(request),
    (request) => {
      const current = pending;
      if (!current || current.request || source.readPage(request.url) !== current.index) return undefined;
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

  function go(site: SitePaginationBar, page: number, control: PaginationControl): void {
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
      const bars = source.findBars();
      const label = bars.map((bar) => source.readLabel(bar.label.textContent ?? '')).find(Boolean);
      const settled = source.settleWithoutRequest !== undefined && label?.page === page && !source.isLoading(bars);
      if (!settled) log.warn('la page demandée n’a pas été chargée', page);
      pending = undefined;
      sync();
    }, source.settleWithoutRequest ?? START_TIMEOUT);
    pending = { index, bar: site.bar, control, timer };
    move();
    sync();
  }

  function moveTo(site: SitePaginationBar, from: number, index: number, control: PaginationControl) {
    if (control === 'previous' && index === from - 1) return () => site.previous.click();
    if (control === 'next' && index === from + 1) return () => site.next.click();
    return source.jump(site, from, index);
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
    const bars = source.findBars();
    for (const [bar, entry] of placed) {
      if (bars.some((site) => site.bar === bar)) continue;
      entry.controller.abort();
      placed.delete(bar);
    }
    observe(bars.map((site) => site.bar));
    for (const site of bars) shown = source.readLabel(site.label.textContent ?? '') ?? shown;
    // Pas encore de numéro lu : la barre du site reste.
    if (!shown) return;
    const loading = source.isLoading(bars);
    for (const site of bars) place(site, shown, loading);
  }

  function place(site: SitePaginationBar, page: PageLabel, loading: boolean): void {
    setClass(site.bar, hiddenClass, true);
    const vnode = h(Pagination, {
      page: pending ? pending.index + 1 : page.page,
      total: page.total,
      hasNext: page.hasNext,
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

  injectStyle(`pagination-${hiddenClass}`, `.${hiddenClass} { display: none !important; }`);
  watchDom(sync, { signal });
}
