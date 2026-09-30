import { injectStyle, setClass, whenBody } from '@/core/dom';
import { net, type NetRequest } from '@/core/net';
import type { Feature } from '@/core/runtime';
import {
  COLLECTION_ROUTE,
  isCollectionList,
  isCollectionSearchField,
  isCollectionStats,
  LIST_LOADING_VEIL,
  readCollectionQuery,
  type CollectionQuery,
} from '@/site/collection';
import { SEARCH_DELAY, searchWait } from './state';

type Kind = 'list' | 'stats';

const WAITING = 'wm-collection-search-waiting';

/** Pendant l'attente, le site est déjà « en chargement » : son voile ne doit pas couvrir la grille. */
const CSS = `html.${WAITING} main ${LIST_LOADING_VEIL} { display: none !important; }`;

interface Waiting {
  readonly load: number;
  readonly resolve: (response: Response | undefined) => void;
}

const isCollectionRequest = (request: NetRequest) => !request.own && (isCollectionList(request) || isCollectionStats(request));

/** Réponse d'une requête remplacée par une plus récente : le site l'ignore (périmée), et en échec, personne ne la garde. */
const superseded = () => new Response(null, { status: 499 });

/**
 * Un changement de filtre (recherche, raretés, listes quand la recherche ne les retient pas) ne charge
 * la liste qu'après un délai sans autre changement : ses requêtes (liste et compteurs) sont retenues avant
 * le réseau, puis envoyées ; celles qu'un chargement plus récent a remplacées n'y vont jamais. La grille
 * reste telle quelle pendant l'attente, le voile du site n'apparaît qu'une fois la requête partie. Une
 * frappe dans le champ de recherche repousse l'envoi : le site n'en fera sa requête que 300 ms plus tard.
 * Intercepteur passé en dernier : ce que d'autres fonctionnalités servent sans le réseau n'attend pas.
 */
export const collectionSearchDelay: Feature = {
  id: 'collection-search-delay',
  name: 'Recherche',
  description: 'Les filtres ne chargent la liste qu’une fois les changements finis.',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    /** Filtres de la dernière requête de chaque genre. */
    const previous: Partial<Record<Kind, CollectionQuery>> = {};
    /** Chargement de chaque requête (numéro) et son attente. */
    const planned = new WeakMap<NetRequest, { readonly load: number; readonly wait: number }>();
    /** Un chargement par requête de la liste ; ses compteurs partent juste avant elle, dans le même chargement. */
    let loads = 0;
    let latest = 0;
    const waiting = new Set<Waiting>();
    let timer: number | undefined;

    const show = () => setClass(document.documentElement, WAITING, waiting.size > 0);

    function release(): void {
      clearTimeout(timer);
      timer = undefined;
      const ready = [...waiting];
      waiting.clear();
      show();
      if (ready.length > 0) log.debug('recherche envoyée', ready.length);
      for (const entry of ready) entry.resolve(undefined);
    }

    /** Un nouveau chargement rend périmé tout ce qui attend d'un chargement précédent. */
    function dropBefore(load: number): void {
      for (const entry of waiting) {
        if (entry.load >= load) continue;
        waiting.delete(entry);
        entry.resolve(superseded());
      }
      if (waiting.size === 0) {
        clearTimeout(timer);
        timer = undefined;
      }
      show();
    }

    signal.addEventListener('abort', release, { once: true });
    document.addEventListener(
      'input',
      (event) => {
        if (waiting.size === 0 || !isCollectionSearchField(event.target)) return;
        clearTimeout(timer);
        timer = window.setTimeout(release, SEARCH_DELAY);
      },
      { capture: true, signal },
    );

    net.track(
      isCollectionRequest,
      (request) => {
        const kind: Kind = isCollectionList(request) ? 'list' : 'stats';
        const query = readCollectionQuery(request.url);
        const load = kind === 'list' ? ++loads : loads + 1;
        latest = Math.max(latest, load);
        planned.set(request, { load, wait: searchWait(query, previous[kind]) });
        previous[kind] = query;
        dropBefore(load);
        return undefined;
      },
      { signal },
    );
    net.intercept(
      isCollectionRequest,
      (request) => {
        const plan = planned.get(request);
        if (!plan) return undefined;
        if (plan.load < latest) return superseded();
        if (plan.wait === 0) return undefined;
        return new Promise<Response | undefined>((resolve) => {
          waiting.add({ load: plan.load, resolve });
          clearTimeout(timer);
          timer = window.setTimeout(release, plan.wait);
          show();
        });
      },
      { signal, last: true },
    );

    await whenBody();
    if (signal.aborted) return;
    injectStyle('collection-search-delay', CSS);
  },
};
