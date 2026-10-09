import { h } from 'preact';
import { watchDom } from '@/core/dom';
import type { FeatureContext } from '@/core/runtime';
import { createSlot } from '@/ui/mount';
import { GAUGE, gaugeCss, SalesGauge } from './SalesGauge';

export { secondsLeft } from './level';

/** Textes des paramètres, les mêmes dans chaque catégorie où le compteur s'affiche. */
export const SALES_LIMIT_TEXTS = {
  name: 'Limite des historiques',
  toggleLabel: 'Afficher le compteur',
  description: 'Compte les historiques de ventes chargés dans la minute : le site refuse au-delà de 30.',
} as const;

/**
 * Compteur des historiques de ventes chargés dans la minute (limite du site : 30 par minute de son horloge), en bas à
 * droite de la fenêtre tant que `shown()` (relu à chaque changement de la page). Avertissement seulement : rien n'est
 * bloqué (demande de l'utilisateur). Le compte lui-même tourne partout (`trackSalesRate`, fonctionnalité `market`).
 */
export function showSalesGauge(ctx: FeatureContext, shown: () => boolean = () => true): void {
  const { signal } = ctx;
  ctx.style(gaugeCss());
  const slot = createSlot(signal);
  watchDom(
    () => {
      if (shown()) slot.render(h(SalesGauge, {}), { parent: document.body, className: GAUGE });
      else slot.clear();
    },
    { signal },
  );
}
