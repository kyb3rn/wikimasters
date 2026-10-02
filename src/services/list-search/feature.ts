import { h } from 'preact';
import { later } from '@/core/async';
import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { lockControl, unlockAll, type LockableControl } from '@/ui/lock';
import { createSlot, type Placement } from '@/ui/mount';
import { toast } from '@/ui/toast';
import { HOLD_SETTING, trackListHold, type ListHoldOptions } from './hold';
import { SearchButton } from './SearchButton';
import type { ListQuery, ListSource } from './types';

/** Options de la recherche retenue propres à une page. */
export type ListSearchHoldOptions<Q extends ListQuery> = Pick<ListHoldOptions<Q>, 'currentChoice' | 'heldReply' | 'toShown' | 'onHeld' | 'onShown'>;

export interface ListSearchConfig<Q extends ListQuery> {
  readonly id: string;
  readonly category: string;
  readonly routes: readonly string[];
  readonly source: ListSource<Q>;
  /** Options de la recherche retenue propres à la page, données au montage. */
  readonly holdOptions?: (signal: AbortSignal) => ListSearchHoldOptions<Q>;
  /** Classe propre au bouton (repère des tests). */
  readonly buttonClass: string;
  /** Place du bouton ; rien tant que les filtres de la page ne sont pas là. */
  place(): Placement | undefined;
  /** Contrôles du site verrouillés tant qu'une recherche attend (pagination, « Charger la suite »). */
  locked(): Iterable<LockableControl>;
  /** De quoi recharger la liste avec les choix affichés ; rien si la page ne le permet pas (état illisible). */
  reloader(): (() => unknown) | undefined;
  /** Bouton du site qui lance le texte du champ (page qui ne cherche qu'à Entrée ou par lui). */
  submit?(): HTMLButtonElement | undefined;
  /** À chaque lancement (bouton, Entrée), juste avant la requête. */
  onLaunch?(): void;
}

const FAILED = "La recherche n'a pas pu être lancée. Rechargez la page.";

/** Marge après l'attente du site sur la frappe : sa recherche est partie (ou ne partira pas). */
const TYPING_MARGIN = 100;

/**
 * Recherche d'une page de liste, réglage « Empêcher le rechargement automatique » : un changement de choix ou
 * de recherche reçoit la liste déjà affichée (`trackListHold`) ; notre bouton au bout des filtres lance le texte
 * du champ s'il a changé, sinon recharge la liste avec les choix tels qu'ils sont (loupe s'ils ont changé, roue
 * pendant le chargement). Entrée dans le champ lance aussi la recherche. Tant qu'une recherche attend, les
 * contrôles qui chargeraient une autre page de la liste (`locked`) sont verrouillés.
 */
export function defineListSearchFeature<Q extends ListQuery>(config: ListSearchConfig<Q>): Feature {
  const { id, source } = config;
  return {
    id,
    name: 'Recherche',
    ...HOLD_SETTING,
    category: config.category,
    routes: config.routes,
    async mount(ctx) {
      const { signal, log } = ctx;
      const slot = createSlot(signal);
      const hold = trackListHold({
        source,
        signal,
        log,
        canReload: () => config.reloader() !== undefined,
        onChange: () => sync(),
        ...config.holdOptions?.(signal),
      });

      /** Dernière frappe dans le champ : la page qui cherche après la frappe n'a peut-être pas encore lancé la sienne. */
      let typedAt = -Infinity;
      const typingDelay = source.typingDelay;
      const isField = (target: EventTarget | null) => target !== null && target === source.field?.();
      if (typingDelay !== undefined) {
        document.addEventListener(
          'input',
          (event) => {
            if (isField(event.target)) typedAt = performance.now();
          },
          { capture: true, signal },
        );
        document.addEventListener(
          'keydown',
          (event) => {
            if (event.key === 'Enter' && isField(event.target) && hold.searchTyped()) run();
          },
          { capture: true, signal },
        );
      }

      function reload(): void {
        const reloadList = config.reloader();
        if (!reloadList) {
          log.warn('rechargement de la liste introuvable');
          toast.error(FAILED, { title: 'Recherche' });
          return;
        }
        try {
          Promise.resolve(reloadList()).catch((error: unknown) => log.debug('rechargement du site en échec', error));
        } catch (error) {
          log.error('rechargement du site en échec', error);
        }
      }

      function run(): void {
        if (hold.status() === 'loading') return;
        hold.launch();
        config.onLaunch?.();
        // Le bouton du site lance le texte du champ, avec les choix tels qu'ils sont.
        const submit = config.submit?.();
        if (hold.searchTyped() && submit && !submit.disabled) {
          submit.click();
          return;
        }
        // Frappe récente : la page va lancer elle-même la recherche tapée, qui part alors (lancée) ; sinon, on recharge.
        const wait = typingDelay === undefined ? 0 : typedAt + typingDelay + TYPING_MARGIN - performance.now();
        if (wait <= 0) reload();
        else
          later(
            () => {
              if (hold.launchPending()) reload();
            },
            wait,
            signal,
          );
      }

      /** Bouton au bout des filtres, contrôles verrouillés tant qu'une recherche attend. Idempotent. */
      function sync(): void {
        if (signal.aborted || !document.body) return;
        const status = hold.status();
        const placement = config.place();
        if (placement) slot.render(h(SearchButton, { status, onClick: run, name: config.buttonClass }), placement);
        else slot.clear();
        for (const control of config.locked()) {
          lockControl(control, { owner: id, locked: status === 'search', reason: "Lancez d'abord la recherche" });
        }
      }

      if (!(await ctx.ready())) return;
      watchDom(sync, { signal });
      sync();
      ctx.onDispose(() => unlockAll(id));
    },
  };
}
