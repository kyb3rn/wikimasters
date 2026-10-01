import { h } from 'preact';
import { classMarks, ROOT_CLASS, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { myUsername, onMeChange } from '@/site/me';
import { findTradeComposer, type TradeSide } from '@/site/trades';
import { createSlot } from '@/ui/mount';
import { alpha, tokens } from '@/ui/theme';
import { SummaryTabs } from './SummaryTabs';

const HOST = 'wm-trade-summary';

const muted = (percent: number) => alpha(tokens.foreground, percent, 'srgb');

/*
 * Chaque moitié est un onglet, à l'allure des onglets soulignés du site : pseudo en accent et trait de 2 px en bas
 * pour l'onglet affiché, pseudo pâle sinon (plus clair au survol). L'icône d'échange au milieu. Un nombre non nul
 * (cartes, wikibidous) en accent. Le résumé n'a plus de marge verticale : les moitiés vont jusqu'à son trait du bas.
 */
const CSS = `
.${HOST} { padding-top: 0; padding-bottom: 0; align-items: stretch; }
.${HOST} > :not(.${ROOT_CLASS}) { display: none !important; }
.${HOST} > .${ROOT_CLASS} { flex: 1; min-width: 0; }
.wm-trade-sum { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: stretch; gap: 12px;
  height: 100%; font-size: 16px; line-height: 24px; font-weight: 600; }
.wm-trade-sum-side { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-width: 0;
  padding: 10px 8px; border: 0; background: none; font: inherit; color: ${muted(50)}; cursor: pointer;
  transition: color 0.15s, box-shadow 0.15s; }
.wm-trade-sum-side:hover { color: ${tokens.foreground}; }
.wm-trade-sum-side[aria-selected="true"] { box-shadow: inset 0 -2px 0 ${tokens.accent}; }
.wm-trade-sum-side[aria-selected="true"] .wm-trade-sum-name { color: ${tokens.accent}; }
.wm-trade-sum-side:focus-visible { outline: 2px solid ${tokens.accent}; outline-offset: -2px; }
.wm-trade-sum-name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 18px; line-height: 26px; }
.wm-trade-sum-counts { display: flex; align-items: center; gap: 12px; color: ${muted(35)}; }
.wm-trade-sum-value { display: inline-flex; flex: none; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; }
.wm-trade-sum-value[data-active] { color: ${tokens.accent}; }
.wm-trade-sum-arrow { align-self: center; color: ${muted(35)}; }
`;

/** Affiche l'onglet de ce côté : le site garde la main (clic sur son onglet, caché). */
const select = (side: TradeSide) => findTradeComposer()?.tabs?.[side].click();

/**
 * Résumé de la fenêtre d'échange (« Moi : 2 cartes · 70 wb ⇄ … ») en plus grand : pseudo (le sien à la place de
 * « Moi »), dessous les nombres suivis d'une icône (cartes, wikibidous, toujours affichés), chaque côté centré dans
 * sa moitié. Chaque moitié sert d'onglet : « Mes cartes » / « Cartes de … » du site sont cachés, elle clique le sien.
 * Relu dans le résumé du site, caché.
 */
export const tradeSummary: Feature = {
  id: 'trade-summary',
  name: "Résumé de l'échange",
  description: "Le résumé de ce que chacun offre dans un échange est plus lisible et sert d'onglets.",
  category: 'Échanges',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    const slot = createSlot(signal);
    const marks = classMarks(signal);

    function sync(): void {
      const composer = findTradeComposer();
      const summary = composer?.summary;
      marks.only(HOST, summary ? [summary.root] : []);
      if (!composer || !summary) {
        slot.clear();
        return;
      }
      // Onglets du site illisibles : ils restent affichés, le résumé ne sert pas d'onglets.
      if (composer.tabs) ctx.hide(composer.tabs.bar);
      const shown = composer.tabs ? composer.tab?.side : undefined;
      slot.render(h(SummaryTabs, { summary, myName: myUsername(), shown, onSelect: select }), { parent: summary.root });
    }

    watchDom(sync, { signal });
    onMeChange(sync, { signal });
  },
};
