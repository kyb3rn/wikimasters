import { h } from 'preact';
import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { findTradeComposer, readTradeWikibidousButton, readTradeWikibidousEditor, type TradeComposerTab } from '@/site/trades';
import { createSlot } from '@/ui/mount';
import { alpha, tokens } from '@/ui/theme';
import { mirrorSiteDialog } from '@/services/site-dialog';
import { titleFor, WikibidousLine } from './WikibidousLine';
import { WikibidousModal } from './WikibidousModal';

const LINE = 'wm-trade-wb-line';

const CSS = `
/* Ligne à part, en tête de l'onglet (avant les filtres, dont trade-selection fixe l'ordre), séparée d'eux par un trait. */
.${LINE} { order: -1; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px;
  padding-bottom: 12px; margin-bottom: 16px; border-bottom: 1px solid ${tokens.border}; }
.wm-trade-wb-label { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: ${alpha(tokens.foreground, 60, 'srgb')}; }
.wm-trade-wb-amount { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; font-variant-numeric: tabular-nums;
  color: ${tokens.foreground}; }
.wm-trade-wb-amount[data-active] { color: ${tokens.accent}; }
.wm-trade-wb { display: flex; flex-direction: column; gap: 12px; }
.wm-trade-wb [data-invalid] { border-color: ${tokens.danger}; }
.wm-trade-wb-note { margin: 0; font-size: 12px; opacity: 0.55; }
.wm-trade-wb-note[data-error] { color: ${tokens.danger}; opacity: 1; }
.wm-trade-wb-actions { display: flex; gap: 8px; margin-top: 4px; }
`;

const freshEditor = () => {
  const editor = findTradeComposer()?.tab?.wikibidousEditor;
  return editor && readTradeWikibidousEditor(editor);
};

/** Montant déjà mis de ce côté : sur le bouton du site, ou dans son champ s'il est ouvert. */
function currentValue(tab: TradeComposerTab): number | undefined {
  if (tab.wikibidousButton) return readTradeWikibidousButton(tab.wikibidousButton)?.value;
  return tab.wikibidousEditor ? readTradeWikibidousEditor(tab.wikibidousEditor)?.value : undefined;
}

/**
 * « Ajouter des WB » de la fenêtre d'échange passe sur une ligne à part, en tête de l'onglet : montant de ce côté
 * (« Wikibidous offerts : 70 », « Wikibidous demandés : 0 ») et « Ajouter des wikibidous » (« Modifier les
 * wikibidous » s'il y en a), qui ouvre une fenêtre au lieu du champ sous la rangée. Le champ du site,
 * caché, reste le moteur : notre bouton l'ouvre, notre fenêtre est affichée tant qu'il l'est, « Enregistrer » y fait
 * ce que fait le sien, la fermeture le referme.
 */
export const tradeWikibidous: Feature = {
  id: 'trade-wikibidous',
  name: 'Wikibidous',
  description: "Les wikibidous d'un échange se choisissent dans une fenêtre.",
  category: 'Échanges',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    const line = createSlot(ctx.signal);

    mirrorSiteDialog(ctx, {
      find: () => {
        const root = findTradeComposer()?.tab?.wikibidousEditor;
        const editor = root && readTradeWikibidousEditor(root);
        return root && editor && { root, editor };
      },
      render: ({ editor }) =>
        h(WikibidousModal, {
          title: titleFor(editor.value),
          // « Wikibidous demandés à … » du site, sans le pseudo (déjà dans le résumé).
          label: editor.label.replace(/ à .+$/, ''),
          value: editor.value,
          max: editor.maxBalance,
          onSave: (value) => freshEditor()?.save(value),
          onClose: () => freshEditor()?.close(),
        }),
    });

    watchDom(
      () => {
        const tab = findTradeComposer()?.tab;
        const value = tab && currentValue(tab);
        if (!tab || value === undefined) {
          line.clear();
          return;
        }
        if (tab.wikibidousButton) ctx.hide(tab.wikibidousButton);
        const { content } = tab;
        // En tête de l'onglet : avant son premier enfant, ou juste avant le suivant si la ligne est déjà là.
        const first = content.firstElementChild;
        const before = first && first === line.ui?.element ? first.nextSibling : content.firstChild;
        const onEdit = () => {
          const button = findTradeComposer()?.tab?.wikibidousButton;
          if (button) readTradeWikibidousButton(button)?.expand();
        };
        line.render(h(WikibidousLine, { side: tab.side, value, onEdit }), { parent: content, before, className: LINE });
      },
      { signal: ctx.signal },
    );
  },
};
