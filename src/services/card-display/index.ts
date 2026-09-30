import { setClass, watchDom, whenBody } from '@/core/dom';
import type { FeatureContext } from '@/core/runtime';
import { defineSettings, onSettingsChange } from '@/core/settings';
import { findCardGrids } from '@/site/cards';

/** Nom commun des réglages d'affichage des cartes : leur section « Apparence » dans l'onglet de chaque page. */
export const CARD_DISPLAY_NAME = 'Apparence';

/** Tailles proposées, en % de la taille du site. */
export const CARD_SCALES = [50, 75, 87.5, 100, 112.5, 125, 150, 200] as const;

/** Espacement accepté : de cartes collées à 64 px, 40 % de la largeur d'une carte à taille normale (160 px). */
export const CARD_GAP = { min: 0, max: 64, step: 2 } as const;

const GRID = 'wm-card-grid';

/**
 * Règles d'une taille (%) et d'un espacement (px). Aux valeurs du site, aucune : ses espacements, qui changent
 * avec la largeur de l'écran, restent les siens. `zoom` agrandit la case entière (face, calques, prix d'une
 * annonce) et la mise en page suit : autant de cartes par ligne que la place le permet. Un voile de chargement
 * posé dans la rangée (`aria-busy`) n'est pas une case.
 */
export function cardDisplayCss(scale: number, gap: number, siteGap: number): string {
  const rules: string[] = [];
  if (scale !== 100) rules.push(`.${GRID} > :not([aria-busy]) { zoom: ${scale / 100}; }`);
  if (gap !== siteGap) rules.push(`.${GRID} { gap: ${gap}px !important; }`);
  return rules.join('\n');
}

/**
 * Taille et espacement des cartes d'une page, réglés à part pour chaque page (`id` : celui de sa fonctionnalité).
 * `siteGap` : espacement du site sur ordinateur, valeur par défaut du réglage.
 */
export function defineCardDisplay(id: string, siteGap: number) {
  const settings = defineSettings(id, {
    scale: {
      type: 'choice',
      display: 'slider',
      label: 'Taille des cartes',
      primary: true,
      default: 100,
      options: CARD_SCALES.map((value) => ({ value, label: `${String(value).replace('.', ',')} %` })),
    },
    gap: {
      type: 'number',
      label: 'Espacement entre les cartes',
      primary: true,
      default: siteGap,
      ...CARD_GAP,
      unit: 'px',
    },
  });

  async function mount(ctx: FeatureContext): Promise<void> {
    await whenBody();
    if (ctx.signal.aborted) return;

    // Une feuille à nous, réécrite à chaque changement de réglage : effet immédiat, fenêtre de paramètres ouverte.
    const style = document.createElement('style');
    style.id = `wm-style-${id}`;
    const apply = () => {
      const css = cardDisplayCss(settings.get('scale'), settings.get('gap'), siteGap);
      if (style.textContent !== css) style.textContent = css;
    };
    apply();
    document.head.append(style);
    onSettingsChange(apply, { signal: ctx.signal });

    watchDom(
      () => {
        for (const grid of findCardGrids()) setClass(grid, GRID, true);
      },
      { signal: ctx.signal },
    );
    ctx.onDispose(() => {
      style.remove();
      document.querySelectorAll(`.${GRID}`).forEach((grid) => grid.classList.remove(GRID));
    });
  }

  return { settings, mount };
}
