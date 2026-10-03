import { h } from 'preact';
import { childController } from '@/core/async';
import { watchDom } from '@/core/dom';
import { hydrationGate } from '@/core/react';
import { matchRoute } from '@/core/router';
import type { Logger } from '@/core/log';
import type { Feature, FeatureContext } from '@/core/runtime';
import { filterLineCss } from '@/services/list-search';
import { OWN_TIME } from '@/site/marketplace';
import { findSideNav, SIDE_NAV_DOT, sideNavHead, sideNavLink } from '@/site/nav';
import { COLLECTION_ROUTE, RESALE_ROUTE } from '@/site/routes';
import { createSlot, type UiSlot } from '@/ui/mount';
import { alpha, tokens } from '@/ui/theme';
import { ResaleLink } from './ResaleLink';
import { RESALE_CLASS, ResalePage } from './ResalePage';
import { resaleSettings } from './settings';

const PAGE = 'wm-resale-page';

/**
 * Sur la page Revente : la Collection du site cachée en CSS (posé dès le chargement, rien ne s'en voit) ; le site
 * allume « Collection » d'après le chemin : éteint ici comme ses liens éteints (`navLinkIdle`), sans toucher à ses
 * classes.
 */
function pageCss(): string {
  const collection = sideNavLink(COLLECTION_ROUTE);
  const { area, line, field, sort, prices, price, section, sale, order } = RESALE_CLASS;
  // Page en colonne sur toute la hauteur de `<main>` : le rond du chargement tombe au milieu. Ligne des filtres comme
  // celles des listes (écart de 12 px du site), prix sous chaque carte comme dans la Collection.
  return `
main > :not(.${PAGE}) { display: none !important; }
main > .wm-root.${PAGE} { display: flex; flex-direction: column; min-height: 100%; line-height: 1.5; }
.${line} { display: flex; gap: 0.75rem; }
/* Le sens du tri collé à sa liste, à 8 px comme les listes de la Collection. */
.${line} > .${order} { margin-left: -0.25rem; }
${filterLineCss({ area, line, field, sort }, { sortBasis: '10rem', sortMin: '8.5rem' })}
.${prices} { display: flex; gap: 4px; width: 100%; margin-top: 6px; }
.${price} { flex: 1 1 0%; min-width: 0; }
.wm-resale-wished { display: flex; }
.${section} { display: flex; flex-direction: column; gap: 12px; }
.${sale} > a { display: block; }
.${sale} > .${prices} { margin-top: 6px; }
.${sale} > a + div { margin-top: 8px; }
/* Temps restant précis au survol de la carte, comme sur les vignettes du marché. */
.${sale}:hover .${OWN_TIME}-short { display: none; }
.${sale}:hover .${OWN_TIME}-precise { display: inline; }
.wm-resale-wished-form { display: flex; flex-direction: column; gap: 12px; }
.wm-resale-wished-form [data-invalid] { border-color: ${tokens.danger}; }
.wm-resale-wished-note { margin: 0; font-size: 12px; opacity: 0.55; }
.wm-resale-wished-actions { display: flex; gap: 8px; margin-top: 4px; }
${collection} { background-color: transparent; color: ${alpha(tokens.foreground, 60)}; }
${collection}:hover { background-color: ${tokens.surfaceLight}; color: ${tokens.foreground}; }
${collection} > ${SIDE_NAV_DOT} { display: none; }
`;
}

const isResale = (route: string) => matchRoute(RESALE_ROUTE, route) !== null;

/**
 * Lien « Revente » tout en haut du menu, au-dessus de « Paquets » : juste après la rangée du logo. Le menu est rendu
 * par le serveur : rien n'y est posé avant que React l'ait repris.
 */
function placeLink(ctx: FeatureContext): void {
  const { signal } = ctx;
  const slot = createSlot(signal);
  const hydration = hydrationGate(signal);
  const sync = () => {
    const nav = findSideNav();
    const head = nav && sideNavHead(nav);
    if (!nav || !head || !hydration.ready(nav, sync)) {
      slot.clear();
      return;
    }
    slot.render(h(ResaleLink, { active: isResale(ctx.route()) }), { parent: nav, after: head, inline: true });
  };
  watchDom(sync, { signal });
  ctx.onRouteChange(sync);
}

/**
 * La page dans `<main>` (rendu par le serveur : une fois repris par React), rendue une fois (elle se met à jour
 * d'elle-même) : seule sa place se surveille.
 */
function placePage(slot: UiSlot, signal: AbortSignal, log: Logger): void {
  const hydration = hydrationGate(signal);
  const sync = () => {
    const main = document.querySelector('main');
    if (!main || !hydration.ready(main, sync)) slot.clear();
    else if (slot.ui?.element.parentNode !== main) slot.render(h(ResalePage, { signal, log }), { parent: main, className: PAGE });
  };
  watchDom(sync, { signal });
}

/**
 * Page Revente (demande de l'utilisateur, version de dev seulement) : sur `/collection?vue=revente`, posée sur la
 * Collection du site, qui reste montée dessous (menu, contextes React et code de sa modale de carte gardés) et charge
 * sa liste comme d'habitude. Ses fonctionnalités ne s'y montent pas (`COLLECTION_ROUTE` ne reconnaît pas la vue). Un
 * seul interrupteur pour le lien et la page : la fonctionnalité est de toutes les pages et monte la sienne sur sa vue.
 */
export const resale: Feature = {
  id: 'resale',
  name: 'Revente',
  description: 'Une page à part liste les cartes sans étiquette, celles à vendre.',
  toggleLabel: 'Afficher la page Revente',
  category: 'Revente',
  routes: 'all',
  defaultOff: true,
  settings: resaleSettings,
  async mount(ctx) {
    const { signal } = ctx;
    const styleFor = (route: string) => ctx.style(isResale(route) ? pageCss() : '', 'page');
    styleFor(ctx.route());
    if (!(await ctx.ready())) return;
    placeLink(ctx);

    let page: AbortController | undefined;
    const sync = (route: string) => {
      styleFor(route);
      if (isResale(route) && !page) {
        page = childController(signal);
        placePage(createSlot(page.signal), page.signal, ctx.log);
      } else if (!isResale(route) && page) {
        page.abort();
        page = undefined;
      }
    };
    sync(ctx.route());
    ctx.onRouteChange(sync);
  },
};
