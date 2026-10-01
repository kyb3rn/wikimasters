import { h } from 'preact';
import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { jsonStore } from '@/core/storage';
import { findMarketplaceTabs } from '@/site/marketplace';
import { navigateTo } from '@/site/router';
import { MARKETPLACE_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';
import { siteClass } from '@/ui/site';
import { alpha, tokens } from '@/ui/theme';
import { Panel, panelCss, type PanelStore } from './Panel';
import { DEFAULT_FILTERS, parseFilters } from './query';

const TAB = 'wm-msearch-tab';
/** Sur la rangée des onglets quand le nôtre est choisi : l'onglet choisi du site y paraît inactif. */
const BAR_OFF = 'wm-msearch-on';
const PANEL = 'wm-msearch-panel';

const css = () => `
.${BAR_OFF} > button[class~="border-b-2"] { color: ${alpha(tokens.foreground, 50, 'srgb')}; border-bottom-color: transparent; }
${panelCss()}
`;

// Gardés tant que la page ne se recharge pas : au retour d'une annonce, la liste est là, telle quelle.
// Filtres affichés, retrouvés après un rechargement de la page.
const savedFilters = /* @__PURE__ */ jsonStore('wm-market-search-v1', DEFAULT_FILTERS, parseFilters);
const store: PanelStore = {
  filters: DEFAULT_FILTERS,
  saveFilters: (filters) => savedFilters.set(filters),
  applied: undefined,
  auctions: undefined,
  cursor: undefined,
  context: { wishlist: undefined },
};
let filtersRead = false;

/**
 * Onglet « Recherche avancée » du marché, juste après « Parcourir » (version de dev seulement) : enchères actives lues
 * directement dans Supabase, avec des filtres que le site n'a pas (prix, temps restant, ATK, DEF, mises…). Choisi à
 * l'arrivée sur le marché ; le contenu de l'onglet du site reste en place, caché ; un clic sur un de ses onglets le rend.
 */
export const marketSearch: Feature = {
  id: 'market-search',
  name: 'Recherche avancée du marché',
  toggleLabel: "Afficher l'onglet",
  description: 'Un onglet du marché cherche les enchères directement dans Supabase, avec plus de filtres.',
  category: 'Développement',
  routes: [MARKETPLACE_ROUTE],
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(css());

    // Outil de dev : le marché s'ouvre sur cet onglet plutôt que sur « Parcourir ».
    let active = true;
    if (!filtersRead) {
      filtersRead = true;
      store.filters = savedFilters.get();
    }
    const tab = createSlot(signal);
    const panel = createSlot(signal);
    const marks = classMarks(signal);

    const open = (href: string) => navigateTo(href);
    const tabNode = () =>
      h(
        'button',
        {
          type: 'button',
          class: `${siteClass.underlineTab} ${active ? siteClass.underlineTabActive : siteClass.underlineTabIdle} ${TAB}`,
          'aria-pressed': active,
          onClick: () => setActive(true),
        },
        'Recherche avancée',
      );

    function setActive(next: boolean): void {
      if (active === next) return;
      active = next;
      sync();
    }

    function sync(): void {
      const tabs = findMarketplaceTabs();
      const container = tabs?.bar.parentElement;
      if (!tabs || !container) return;
      const { bar, browse } = tabs;

      tab.render(tabNode(), { parent: bar, after: browse, inline: true });
      // Posé juste après les onglets, puis laissé tel quel tant qu'il est dans la page : ses états restent les siens.
      const panelUi =
        panel.ui?.element.parentElement === container
          ? panel.ui
          : panel.render(h(Panel, { store, onOpen: open }), { parent: container, after: bar, className: PANEL });

      marks.set(bar, BAR_OFF, active);
      ctx.hide(panelUi.element, !active);
      // Le contenu de l'onglet du site, caché tant que le nôtre est choisi.
      for (let element = bar.nextElementSibling; element; element = element.nextElementSibling) {
        if (element !== panelUi.element) ctx.hide(element, active);
      }
    }

    // Un onglet du site choisi (même celui qui l'était déjà) rend son contenu.
    document.addEventListener(
      'click',
      (event) => {
        const button = event.target instanceof Element ? event.target.closest('button') : null;
        const tabs = findMarketplaceTabs();
        if (button && tabs && button.parentElement === tabs.bar) setActive(false);
      },
      { capture: true, signal },
    );

    watchDom(sync, { signal });
  },
};
