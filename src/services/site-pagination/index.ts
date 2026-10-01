import { h } from 'preact';
import { later } from '@/core/async';
import { setHidden, unhideAll, watchDom, whenBody } from '@/core/dom';
import type { Logger } from '@/core/log';
import { net, type NetRequest } from '@/core/net';
import type { StateHook } from '@/core/react';
import { textOf } from '@/core/text';
import type { ListQuery, ListSource } from '@/site/list-query';
import { parsePageLabel, type PageLabel, type SitePaginationBar } from '@/site/pagination';
import { Pagination, type PaginationControl } from '@/ui/controls';
import { lockReason } from '@/ui/lock';
import { createSlots } from '@/ui/mount';
import { toast } from '@/ui/toast';

/** Saut de page : de quoi aller directement à la page `index` depuis `from` (à partir de 0), comme la page le ferait. */
export type PageJump = (bar: SitePaginationBar, from: number, index: number) => (() => void) | undefined;

export interface SitePaginationSource {
  /** Liste de la page : ses requêtes disent la page chargée (`page`, à partir de 0). */
  readonly list: ListSource<ListQuery>;
  findBars(): SitePaginationBar[];
  isLoading(bars: readonly SitePaginationBar[]): boolean;
  readonly jump: PageJump;
  /**
   * La page peut s'afficher sans requête (gardée par le site) : passé ce délai sans requête, la page visée est
   * tenue pour affichée si la barre la montre, hors chargement.
   */
  readonly settleWithoutRequest?: number;
}

export interface SitePaginationOptions {
  readonly signal: AbortSignal;
  readonly log: Logger;
}

/** Une page demandée dont la liste ne part pas dans ce délai est abandonnée (le site n'a pas suivi). */
const START_TIMEOUT = 2000;

interface Pending {
  /** Page demandée, à partir de 0. */
  readonly index: number;
  /** Barre du site sous laquelle on a cliqué, et quoi : la roue n'est que sur ce bouton. */
  readonly bar: HTMLElement;
  readonly control: PaginationControl;
  readonly cancel: () => void;
  request?: NetRequest;
}

/**
 * Saut de page par l'état `page` de la page (à partir de 0, lu à chaque fois : rien s'il ne vaut plus la page
 * affichée), puis retour en haut de `<main>`, comme le fait la page.
 */
export function jumpByPageState(findPage: () => StateHook | undefined): PageJump {
  return (_bar, from, index) => {
    const page = findPage();
    if (page?.value !== from) return undefined;
    return () => {
      page.set(index);
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    };
  };
}

/**
 * Chaque barre de pagination du site est cachée, la nôtre (|< < Page [n] / total > >|) posée juste après elle.
 * Précédente et suivante cliquent les boutons du site ; première, dernière et numéro saisi passent par
 * `jump`. La page visée s'affiche aussitôt ; elle est demandée après un court délai sans autre clic
 * (`Pagination`), puis tout est désactivé jusqu'à la fin de la requête de la liste. Un verrou posé sur les
 * boutons du site (recherche en attente) désactive la nôtre. Posée dès `<body>`, retirée à l'interruption de `signal`.
 */
export function replaceSitePagination(source: SitePaginationSource, { signal, log }: SitePaginationOptions): void {
  const owner = `site-pagination-${source.list.id}`;
  const slots = createSlots<HTMLElement>(signal);
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
      unhideAll(owner);
    },
    { once: true },
  );

  net.track(
    (request) => !request.own && source.list.isList(request),
    (request) => {
      const current = pending;
      if (!current || current.request || source.list.readQuery(request.url).page !== current.index) return undefined;
      current.request = request;
      current.cancel();
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
    const target: Pending = {
      index,
      bar: site.bar,
      control,
      cancel: later(
        () => {
          if (pending !== target || target.request) return;
          const bars = source.findBars();
          const label = bars.map((bar) => parsePageLabel(textOf(bar.label))).find(Boolean);
          const settled = source.settleWithoutRequest !== undefined && label?.page === page && !source.isLoading(bars);
          if (!settled) log.warn('la page demandée n’a pas été chargée', page);
          pending = undefined;
          sync();
        },
        source.settleWithoutRequest ?? START_TIMEOUT,
        signal,
      ),
    };
    pending = target;
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
    slots.prune((bar) => bars.some((site) => site.bar === bar));
    observe(bars.map((site) => site.bar));
    for (const site of bars) shown = parsePageLabel(textOf(site.label)) ?? shown;
    // Pas encore de numéro lu : la barre du site reste.
    if (!shown) return;
    const loading = source.isLoading(bars);
    for (const site of bars) place(site, shown, loading);
  }

  function place(site: SitePaginationBar, page: PageLabel, loading: boolean): void {
    const parent = site.bar.parentElement;
    if (!parent) return;
    setHidden(site.bar, owner, true);
    const vnode = h(Pagination, {
      page: pending ? pending.index + 1 : page.page,
      total: page.total,
      hasNext: page.hasNext,
      busy: pending ? (pending.bar === site.bar ? pending.control : true) : loading,
      lockedReason: lockReason(site.previous) ?? lockReason(site.next),
      onChange: (target, control) => go(site, target, control),
    });
    slots.render(site.bar, vnode, { parent, after: site.bar });
  }

  void whenBody(signal).then((body) => {
    if (body) watchDom(sync, { signal });
  });
}
