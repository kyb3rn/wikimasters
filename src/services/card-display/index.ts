import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { defineSettings, onSettingsChange } from '@/core/settings';
import { findCardGrids } from '@/site/cards';

/** Nom commun des réglages d'affichage des cartes : leur section « Apparence » dans l'onglet de chaque page. */
export const CARD_DISPLAY_NAME = 'Apparence';

/** Tailles proposées, en % de la taille du site. */
export const CARD_SCALES = [50, 75, 87.5, 100, 112.5, 125, 150, 200] as const;

/** Espacement accepté : de cartes collées à 64 px, 40 % de la largeur d'une carte à taille normale (160 px). */
export const CARD_GAP = { min: 0, max: 64, step: 2 } as const;

/**
 * Grille à nous faite comme celles du site (recherche avancée du marché) : elle suit le réglage du conteneur où elle
 * est, comme celles du site (`findCardGrids` ne voit que les leurs).
 */
export const OWN_CARD_GRID = 'wm-own-card-grid';

/** Classe des grilles qu'un réglage règle : `wm-<id de sa fonctionnalité>`. */
export const cardGridClass = (id: string): string => `wm-${id}`;

/**
 * Règles d'une taille (%) et d'un espacement (px) pour les grilles du réglage `id`. Aux valeurs du site, aucune : ses
 * espacements, qui changent avec la largeur de l'écran, restent les siens. `zoom` agrandit la case entière (face,
 * calques, prix d'une annonce) et la mise en page suit : autant de cartes par ligne que la place le permet. Un voile
 * de chargement posé dans la rangée (`aria-busy`) n'est pas une case.
 */
export function cardDisplayCss(id: string, scale: number, gap: number, siteGap: number): string {
  const grid = `.${cardGridClass(id)}`;
  const rules: string[] = [];
  if (scale !== 100) rules.push(`${grid} > :not([aria-busy]) { zoom: ${scale / 100}; }`);
  if (gap !== siteGap) rules.push(`${grid} { gap: ${gap}px !important; }`);
  return rules.join('\n');
}

function cardDisplaySettings(id: string, siteGap: number) {
  return defineSettings(id, {
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
}

export interface CardDisplayConfig {
  /** Identifiant de la fonctionnalité, clé de ses réglages. */
  readonly id: string;
  readonly category: string;
  readonly routes: Feature['routes'];
  readonly description: string;
  /** Espacement du site sur ordinateur : valeur par défaut du réglage. */
  readonly siteGap: number;
  /**
   * Conteneur réglé à part, où qu'il s'ouvre (fenêtre d'échange) : le réglage ne prend que ses grilles, et les
   * réglages des pages les laissent. Absent : les grilles de la page, hors de ces conteneurs.
   */
  readonly container?: () => Element | undefined;
}

export type CardDisplayFeature = Feature & { readonly settings: ReturnType<typeof cardDisplaySettings> };

/** Conteneurs réglés à part, de tous les réglages (connus dès le chargement : chacun est défini au niveau du module). */
const containers: (() => Element | undefined)[] = [];

function gridsIn(root: ParentNode): HTMLElement[] {
  return [...findCardGrids(root), ...root.querySelectorAll<HTMLElement>(`.${OWN_CARD_GRID}`)];
}

function pageGrids(): HTMLElement[] {
  const roots = containers.map((find) => find()).filter((root) => root !== undefined);
  return gridsIn(document).filter((grid) => !roots.some((root) => root.contains(grid)));
}

/**
 * Taille et espacement des cartes d'un conteneur (une page, ou une fenêtre réglée à part), dans la section
 * « Apparence » de l'onglet `category`. Chaque réglage ne touche que ses grilles.
 */
export function cardDisplayFeature(config: CardDisplayConfig): CardDisplayFeature {
  const { id, siteGap, container } = config;
  const settings = cardDisplaySettings(id, siteGap);
  if (container) containers.push(container);
  const grids = container
    ? () => {
        const root = container();
        return root ? gridsIn(root) : [];
      }
    : pageGrids;

  return {
    id,
    name: CARD_DISPLAY_NAME,
    description: config.description,
    category: config.category,
    routes: config.routes,
    required: true,
    settings,
    async mount(ctx) {
      if (!(await ctx.ready())) return;
      // Réécrite à chaque changement de réglage : effet immédiat, fenêtre de paramètres ouverte.
      const apply = () => ctx.style(cardDisplayCss(id, settings.get('scale'), settings.get('gap'), siteGap));
      apply();
      onSettingsChange(apply, { signal: ctx.signal });

      const marks = classMarks(ctx.signal);
      const name = cardGridClass(id);
      watchDom(() => marks.only(name, grids()), { signal: ctx.signal });
    },
  };
}
