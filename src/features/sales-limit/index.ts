import { h } from 'preact';
import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { findMarketplaceTabs } from '@/site/marketplace';
import { MARKETPLACE_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';
import { GAUGE, gaugeCss, SalesGauge } from './SalesGauge';

/**
 * Compteur des historiques de ventes chargés dans la minute (limite du site : 30 par minute de son horloge), en bas à
 * droite de la fenêtre, sur les onglets « Parcourir » et « Recherche avancée » du marché. Avertissement seulement :
 * rien n'est bloqué (demande de l'utilisateur). Le compte lui-même tourne partout (`trackSalesRate`, fonctionnalité
 * `market`).
 */
export const salesLimit: Feature = {
  id: 'sales-limit',
  name: 'Limite des historiques',
  toggleLabel: 'Afficher le compteur',
  description: 'Compte les historiques de ventes chargés dans la minute : le site refuse au-delà de 30.',
  category: 'Marché',
  routes: [MARKETPLACE_ROUTE],
  defaultOff: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(gaugeCss());
    const slot = createSlot(signal);

    watchDom(
      () => {
        const tabs = findMarketplaceTabs();
        const shown = tabs !== undefined && (tabs.addedActive || tabs.active === 'browse');
        if (shown) slot.render(h(SalesGauge, {}), { parent: document.body, className: GAUGE });
        else slot.clear();
      },
      { signal },
    );
  },
};
