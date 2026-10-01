import { h } from 'preact';
import { childController, later } from '@/core/async';
import { watchDom } from '@/core/dom';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { textOf } from '@/core/text';
import { claimDateOf, fetchProDaily } from '@/site/api';
import { onServerSecond, serverNow } from '@/site/clock';
import { findProDailyStates, findProPack, isProDaily, isProDailyStatus, proClaimDate, type ProPack as SiteProPack } from '@/site/pulls';
import { PULLS_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';
import { ProPack, type ProPackState } from './ProPack';
import { midnightAfter, nextMidnight } from './time';

const CSS = `
.wm-pro-pack-root { max-width: 100%; }
.wm-pro-pack { width: 400px; max-width: 100%; }
`;

/**
 * Relances de notre demande quand elle échoue, ou quand le serveur dit encore « réclamé » passé minuit
 * (horloges à la seconde près) ; ensuite, « Réessayer ».
 */
const RETRY_DELAYS = [2000, 5000, 15_000, 30_000];

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
    /** Dernière demande de disponibilité (du site ou nôtre) en échec : sans réponse valable, le cadre du site reste vide. */
    let failed = false;
    /** Jour dont parle la dernière réponse de la route ; à défaut, celui que le site retient. */
    let claimDate: string | undefined;
    /** Fin du décompte sans jour d'ouverture connu : fixe, sans quoi passé minuit il repartirait pour un jour. */
    let fallbackDeadline: number | undefined;
    /** Notre demande en cours, relance prévue, relances épuisées, état de la page introuvable. */
    let refreshing = false;
    let attempts = 0;
    let cancelRetry: (() => void) | undefined;
    let exhausted = false;
    let unreachable = false;
    /** Décompte affiché : la page est redessinée à chaque seconde du serveur. */
    let ticking: AbortController | undefined;
    const slot = createSlot(signal);

    net.observe(
      isProDaily,
      async (exchange) => {
        const date = claimDateOf(await exchange.json().catch(() => undefined));
        if (date) claimDate = date;
      },
      { signal },
    );
    net.track(
      isProDailyStatus,
      () => {
        failed = false;
        sync();
        return (code) => {
          failed = code === undefined || code < 200 || code >= 300;
          sync();
        };
      },
      { signal },
    );

    if (!(await ctx.ready())) return;
    ctx.style(CSS);

    function deadlineOf(): number {
      const date = claimDate ?? proClaimDate();
      if (date) return midnightAfter(date);
      fallbackDeadline ??= nextMidnight(serverNow());
      return fallbackDeadline;
    }

    function scheduleRetry(): void {
      const delay = RETRY_DELAYS[attempts];
      if (delay === undefined) {
        exhausted = true;
        return;
      }
      attempts += 1;
      cancelRetry = later(
        () => {
          cancelRetry = undefined;
          void refresh();
        },
        delay,
        signal,
      );
    }

    /**
     * Redemande au site si le pack est disponible (le site ne le fait qu'au chargement de la page) et lui passe
     * la réponse : il redessine son cadre comme après sa propre demande.
     */
    async function refresh(): Promise<void> {
      if (refreshing || signal.aborted) return;
      refreshing = true;
      exhausted = false;
      cancelRetry?.();
      cancelRetry = undefined;
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
        if (result.eligible || (result.claimedToday && deadlineOf() > serverNow())) attempts = 0;
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
      const waiting = refreshing || cancelRetry !== undefined;
      const stalled = (): { state: ProPackState; refresh: boolean } => {
        if (unreachable) return { state: { kind: 'reload' }, refresh: false };
        if (exhausted) return { state: { kind: 'error' }, refresh: false };
        return { state: { kind: 'loading' }, refresh: !waiting };
      };
      if (!pack.claimed) fallbackDeadline = undefined;
      if (pack.button) {
        attempts = 0;
        exhausted = false;
        const opening = textOf(pack.button).startsWith('Ouverture');
        return { state: { kind: 'available', disabled: pack.button.disabled, opening }, refresh: false };
      }
      if (pack.claimed) {
        const remaining = deadlineOf() - serverNow();
        return remaining > 0 ? { state: { kind: 'claimed', remaining }, refresh: false } : stalled();
      }
      if (failed || waiting || exhausted || unreachable) return stalled();
      return { state: { kind: 'loading' }, refresh: false };
    }

    /** Le décompte avance au changement de seconde de l'horloge du serveur, tant qu'il est affiché. */
    function tick(on: boolean): void {
      if (on && !ticking) {
        ticking = childController(signal);
        onServerSecond(sync, { signal: ticking.signal });
      } else if (!on && ticking) {
        ticking.abort();
        ticking = undefined;
      }
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
        tick(false);
        slot.clear();
        return;
      }
      ctx.hide(pack.root);
      if (!slot.ui) log.debug(`états de la page ${findProDailyStates(pack) ? 'lus' : 'introuvables'}`);
      const { state, refresh: needed } = stateOf(pack);
      tick(state.kind === 'claimed');
      if (needed) queueMicrotask(() => void refresh());
      const vnode = h(ProPack, { state, onOpen: open, onRetry: () => void refresh(), onReload: () => location.reload() });
      slot.render(vnode, { parent, before: pack.root, className: 'wm-pro-pack-root' });
    }

    watchDom(sync, { signal });
  },
};
