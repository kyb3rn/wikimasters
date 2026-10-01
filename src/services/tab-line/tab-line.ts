import { h } from 'preact';
import { classMarks, watchDom } from '@/core/dom';
import type { FeatureContext } from '@/core/runtime';
import { createSlot } from '@/ui/mount';
import { tokens } from '@/ui/theme';
import { TabLineButton } from './TabLineButton';

const BAR = 'wm-tab-line';
const SCROLLING = 'wm-tab-line-scrolling';
const BUTTON = 'wm-tab-line-button';

/*
 * Le trait du menu s'arrête au dernier onglet, pas sous le bouton : la bordure de la rangée devient transparente (sa
 * place reste) et chaque onglet dessine sa part du trait juste en dessous, là où elle était ; le souligné de l'onglet
 * choisi reste posé dessus, comme chez le site. Une rangée qui défile en largeur (`overflow-x-auto`) couperait un
 * trait dessiné dans sa bordure : il l'est alors dans une marge intérieure de 1 px qui la remplace (même hauteur).
 */
const CSS = `
.${BAR} { border-bottom-color: transparent; }
.${BAR}.${SCROLLING} { border-bottom-width: 0; padding-bottom: 1px; }
.${BAR} > button { box-shadow: 0 1px 0 ${tokens.border}; }
.${BUTTON} { flex: none; align-self: center; margin-left: 16px; }
`;

export interface TabLineTarget {
  readonly tabBar: HTMLElement;
  /** Bouton du site, que le nôtre clique. */
  readonly source: HTMLButtonElement;
  /** Ce qui est caché : le bouton du site, ou le bloc qui le porte. */
  readonly hidden: HTMLElement;
}

export interface TabLineOptions {
  readonly find: () => TabLineTarget | undefined;
  readonly label: string;
  readonly narrowLabel?: string;
  readonly size: 'md' | 'lg';
  /** Classe de notre bouton (repère). */
  readonly className: string;
  /** La rangée défile en largeur. */
  readonly scrolling?: boolean;
}

/**
 * Bouton d'action de la page (« Proposer un échange », « Inviter ») posé au bout de sa rangée d'onglets, qui gardent
 * le reste de la largeur ; celui du site est caché et cliqué par le nôtre. À appeler une fois `<body>` là
 * (`ctx.ready()`) ; tout est retiré au démontage.
 */
export function placeTabLineButton(ctx: FeatureContext, options: TabLineOptions): void {
  const { signal } = ctx;
  const { find, scrolling = false, ...button } = options;
  ctx.style(CSS, 'tab-line');
  const slot = createSlot(signal);
  const marks = classMarks(signal);
  let hidden: HTMLElement | undefined;

  watchDom(
    () => {
      const target = find();
      if (hidden && hidden !== target?.hidden) ctx.hide(hidden, false);
      hidden = target?.hidden;
      marks.only(BAR, target ? [target.tabBar] : []);
      marks.only(SCROLLING, target && scrolling ? [target.tabBar] : []);
      if (!target) {
        slot.clear();
        return;
      }
      const { tabBar, source } = target;
      ctx.hide(target.hidden);
      // Au bout de la rangée : reposé si React la recrée ou ajoute un onglet après nous.
      slot.render(
        h(TabLineButton, { ...button, className: `${BUTTON} ${button.className}`, disabled: source.disabled, onClick: () => source.click() }),
        { parent: tabBar, before: null, inline: true },
      );
    },
    { signal },
  );
}
