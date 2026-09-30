import { h } from 'preact';
import { childController } from '@/core/async';
import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { claimDateOf, fetchProDaily } from '@/site/api';
import {
  findProDailyStates,
  findProPack,
  isProDailyRoute,
  isProDailyStatus,
  proClaimDate,
  PULLS_ROUTE,
  type ProPack as SiteProPack,
} from '@/site/pulls';
import { mountUi, type MountedUi } from '@/ui/mount';
import { ProPack, type ProPackState } from './ProPack';
import { midnightAfter, nextMidnight, serverOffset } from './time';

const HIDDEN = 'wm-pro-pack-hidden';

const CSS = `
.${HIDDEN} { display: none !important; }
.wm-pro-pack-root { max-width: 100%; }
.wm-pro-pack { width: 400px; max-width: 100%; }
`;

/**
 * Relances de notre demande quand elle échoue, ou quand le serveur dit encore « réclamé » passé minuit
 * (horloges à la seconde près) ; ensuite, « Réessayer ».
 */
const RETRY_DELAYS = [2000, 5000, 15_000, 30_000];

/** Réponses fraîches du site ou de Supabase, dont l'en-tête `Date` donne l'heure du serveur. */
const isDynamic = (path: string) => path.startsWith('/api/') || path.startsWith('/rest/v1/');

export const pullsPro: Feature = {
  id: 'pulls-pro',
  name: 'Pack Pro',
  description:
    "Cadre du pack PRO du jour : titre, description, bouton « Ouvrir », temps restant jusqu'à minuit quand il est déjà ouvert, puis disponible sans recharger la page.",
  category: 'Paquets',
  routes: [PULLS_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    let placed: { readonly ui: MountedUi; readonly controller: AbortController } | undefined;
    /** Avance de l'horloge du serveur sur celle du PC. */
    let offset = 0;
    /** Dernière demande de disponibilité (du site ou nôtre) : sans réponse valable, le cadre du site reste vide. */
    let status: 'pending' | 'ok' | 'failed' = 'pending';
    /** Jour dont parle la dernière réponse de la route ; à défaut, celui que le site retient. */
    let claimDate: string | undefined;
    /** Fin du décompte sans jour d'ouverture connu : fixe, sans quoi passé minuit il repartirait pour un jour. */
    let fallbackDeadline: number | undefined;
    /** Notre demande en cours, relance prévue, relances épuisées, état de la page introuvable. */
    let refreshing = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let exhausted = false;
    let unreachable = false;
    let tickTimer: ReturnType<typeof setTimeout> | undefined;
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(tickTimer);
        clearTimeout(retryTimer);
      },
      { once: true },
    );
    const now = () => Date.now() + offset;

    net.observe(
      (request) => !request.own && isDynamic(request.url.pathname),
      (exchange) => {
        if (exchange.synthetic) return;
        const measured = serverOffset(exchange.headers, exchange.startedAt + exchange.duration);
        if (measured !== undefined) offset = measured;
      },
      { signal },
    );
    net.observe(isProDailyRoute, async (exchange) => {
      const date = claimDateOf(await exchange.json().catch(() => undefined));
      if (date) claimDate = date;
    }, { signal });
    net.track(
      isProDailyStatus,
      () => {
        status = 'pending';
        sync();
        return (code) => {
          status = code !== undefined && code >= 200 && code < 300 ? 'ok' : 'failed';
          sync();
        };
      },
      { signal },
    );

    await whenBody();
    if (signal.aborted) return;
    injectStyle('pulls-pro', CSS);

    function remove(): void {
      placed?.controller.abort();
      placed = undefined;
    }

    function deadlineOf(): number {
      const date = claimDate ?? proClaimDate();
      if (date) return midnightAfter(date);
      fallbackDeadline ??= nextMidnight(now());
      return fallbackDeadline;
    }

    function scheduleRetry(): void {
      const delay = RETRY_DELAYS[attempts];
      if (delay === undefined) {
        exhausted = true;
        return;
      }
      attempts += 1;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void refresh();
      }, delay);
    }

    /**
     * Redemande au site si le pack est disponible (le site ne le fait qu'au chargement de la page) et lui passe
     * la réponse : il redessine son cadre comme après sa propre demande.
     */
    async function refresh(): Promise<void> {
      if (refreshing || signal.aborted) return;
      refreshing = true;
      exhausted = false;
      clearTimeout(retryTimer);
      retryTimer = undefined;
      sync();
      try {
        const result = await fetchProDaily();
        if (signal.aborted) return;
        if (result.claimDate) claimDate = result.claimDate;
        const pack = findProPack();
        const states = pack && findProDailyStates(pack);
        if (!states) {
          log.warn("état de la page /pulls introuvable : le pack du jour ne peut être montré qu'en rechargeant");
          unreachable = true;
          return;
        }
        states.eligible.set(result.eligible);
        states.claimed.set(result.claimedToday);
        if (result.eligible || (result.claimedToday && deadlineOf() > now())) attempts = 0;
        else scheduleRetry();
      } catch (error) {
        log.warn('disponibilité du pack du jour non reçue', error);
        scheduleRetry();
      } finally {
        refreshing = false;
        sync();
      }
    }

    /** L'état affiché ; `refresh` : le demander nous-mêmes (minuit passé, demande du site en échec). */
    function stateOf(pack: SiteProPack): { state: ProPackState; refresh: boolean } {
      const waiting = refreshing || retryTimer !== undefined;
      const stalled = (): { state: ProPackState; refresh: boolean } => {
        if (unreachable) return { state: { kind: 'reload' }, refresh: false };
        if (exhausted) return { state: { kind: 'error' }, refresh: false };
        return { state: { kind: 'loading' }, refresh: !waiting };
      };
      if (!pack.claimed) fallbackDeadline = undefined;
      if (pack.button) {
        attempts = 0;
        exhausted = false;
        const opening = (pack.button.textContent ?? '').trim().startsWith('Ouverture');
        return { state: { kind: 'available', disabled: pack.button.disabled, opening }, refresh: false };
      }
      if (pack.claimed) {
        const remaining = deadlineOf() - now();
        return remaining > 0 ? { state: { kind: 'claimed', remaining }, refresh: false } : stalled();
      }
      if (status === 'failed' || waiting || exhausted || unreachable) return stalled();
      return { state: { kind: 'loading' }, refresh: false };
    }

    /** Le décompte avance au changement de seconde de l'horloge du serveur. */
    function tick(): void {
      if (tickTimer !== undefined || signal.aborted) return;
      tickTimer = setTimeout(
        () => {
          tickTimer = undefined;
          sync();
        },
        1000 - (now() % 1000) + 5,
      );
    }

    function open(): void {
      const button = findProPack()?.button;
      if (button && !button.disabled) button.click();
    }

    function sync(): void {
      if (signal.aborted) return;
      const pack = findProPack();
      const parent = pack?.root.parentElement;
      if (!pack || !parent) {
        remove();
        return;
      }
      setClass(pack.root, HIDDEN, true);
      if (!placed) log.debug(`états de la page ${findProDailyStates(pack) ? 'lus' : 'introuvables'}`);
      const { state, refresh: needed } = stateOf(pack);
      if (state.kind === 'claimed') tick();
      if (needed) queueMicrotask(() => void refresh());
      const vnode = h(ProPack, { state, onOpen: open, onRetry: () => void refresh(), onReload: () => location.reload() });
      if (placed?.ui.element.parentElement === parent && placed.ui.element.nextElementSibling === pack.root) {
        placed.ui.update(vnode);
        return;
      }
      remove();
      const controller = childController(signal);
      placed = {
        ui: mountUi(vnode, { parent, before: pack.root, className: 'wm-pro-pack-root', signal: controller.signal }),
        controller,
      };
    }

    watchDom(sync, { signal });
    ctx.onDispose(() => {
      remove();
      document.querySelectorAll(`.${HIDDEN}`).forEach((el) => el.classList.remove(HIDDEN));
    });
  },
};
