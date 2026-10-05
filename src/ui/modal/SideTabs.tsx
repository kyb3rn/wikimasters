import type { ComponentChildren } from 'preact';
import { injectStyle } from '@/core/dom';
import { Icon, type IconName } from '@/ui/icons';
import { alpha, tokens } from '@/ui/theme';

const CSS = `
.wm-modal-body:has(.wm-side-nav) { min-height: 340px; }
.wm-side-nav { flex: none; width: 240px; padding: 12px; display: flex; flex-direction: column; gap: 4px;
  border-right: 1px solid ${tokens.border}; overflow-y: auto; }
.wm-side-tab { display: flex; align-items: center; gap: 10px; text-align: left; padding: 8px 12px; border: 0;
  border-radius: 10px; background: none; font: inherit; color: inherit; white-space: nowrap; cursor: pointer; opacity: 0.75; }
.wm-side-tab svg { flex: none; }
.wm-side-tab:hover { opacity: 1; background: ${tokens.surfaceLight}; }
.wm-side-tab[aria-current="page"] { opacity: 1; font-weight: 600; color: ${tokens.accent}; background: ${alpha(tokens.accent, 12, 'srgb')}; }
.wm-side-tab[data-end] { margin-top: auto; }
.wm-side-content { flex: 1; min-width: 0; padding: 16px 20px 20px; overflow-y: auto; }

@media (max-width: 640px) {
  .wm-modal-body:has(.wm-side-nav) { flex-direction: column; }
  .wm-side-nav { width: auto; flex-direction: row; overflow-x: auto; border-right: 0;
    border-bottom: 1px solid ${tokens.border}; }
  .wm-side-tab { flex: none; }
  .wm-side-tab[data-end] { margin-top: 0; margin-left: auto; }
}
`;

export interface SideTab {
  readonly label: string;
  readonly icon?: IconName;
  /** Rangé tout en bas de la colonne (« À propos »). */
  readonly end?: boolean;
}

export interface SideTabsProps {
  /** Nom de la colonne, pour les lecteurs d'écran (« Catégories »). */
  readonly label: string;
  readonly tabs: readonly SideTab[];
  readonly current: string;
  readonly onSelect: (tab: string) => void;
  /** Contenu de l'onglet choisi. */
  readonly children: ComponentChildren;
}

/** Corps d'une `Modal` en onglets : colonne de 240 px à gauche, contenu de l'onglet choisi à droite. */
export function SideTabs({ label, tabs, current, onSelect, children }: SideTabsProps) {
  injectStyle('side-tabs', CSS);
  return (
    <>
      <nav class="wm-side-nav" aria-label={label}>
        {tabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            class="wm-side-tab"
            data-end={tab.end ? '' : undefined}
            aria-current={tab.label === current ? 'page' : undefined}
            onClick={() => onSelect(tab.label)}
          >
            {tab.icon && <Icon name={tab.icon} size={18} />}
            {tab.label}
          </button>
        ))}
      </nav>
      <section class="wm-side-content">{children}</section>
    </>
  );
}
