import type { ComponentChildren } from 'preact';
import { buttonClass, type ButtonFill, type ButtonTone } from '@/ui/button';
import { Icon, type IconName } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { selectedLabel } from './label';

export interface ToggleProps {
  readonly active: boolean;
  /** Cartes sélectionnées (en sélection seulement). */
  readonly count: number;
  /** Le site ne laisse pas entrer en sélection (aucune carte). */
  readonly disabled: boolean;
  readonly onClick: () => void;
}

/** Au bout de la ligne des filtres : « n sélectionnées » (en sélection), puis le bouton du mode. */
export function SelectionToggle({ active, count, disabled, onClick }: ToggleProps) {
  const label = active ? 'Quitter la sélection' : 'Sélectionner des cartes';
  return (
    <>
      {active && (
        <span class={`${siteClass.selectionCount} wm-selection-count`}>
          <span class={siteClass.selectionCountValue}>{count}</span>
          <span class={siteClass.selectionCountLabel}>{selectedLabel(count)}</span>
        </span>
      )}
      <button
        type="button"
        class={`${buttonClass('square', active ? { tone: 'accent', fill: 'solid' } : {})} wm-selection-toggle`}
        aria-label={label}
        title={label}
        aria-pressed={active}
        disabled={disabled && !active}
        onClick={onClick}
      >
        <Icon name="select" size={18} />
      </button>
    </>
  );
}

/** Bouton de la barre du bas. */
export interface SelectionAction {
  /** Clé stable d'un rendu à l'autre (le texte peut changer : « Mettre en favori (3) »). */
  readonly key: string;
  readonly icon: IconName | undefined;
  readonly label: string;
  /** Autre contenu à la même place, montré quand `shown` : le bouton garde la largeur du plus long. */
  readonly alternate?: { readonly icon?: IconName; readonly label: string; readonly shown: boolean };
  readonly disabled: boolean;
  /** Requête en cours : roue à la place de l'icône, bouton désactivé. */
  readonly busy?: boolean;
  readonly tone?: ButtonTone;
  readonly fill?: ButtonFill;
  readonly onClick: () => void;
}

/** Deux contenus l'un sur l'autre, un seul visible : le bouton garde la largeur du plus long quand il change. */
function Swap({ second, first, other }: { readonly second: boolean; readonly first: ComponentChildren; readonly other: ComponentChildren }) {
  return (
    <span class="wm-swap">
      <span data-off={second || undefined}>{first}</span>
      <span data-off={!second || undefined}>{other}</span>
    </span>
  );
}

function ActionButton({ action }: { readonly action: SelectionAction }) {
  const { icon, label, alternate, busy = false } = action;
  const first = (
    <>
      {(icon || busy) && <Icon name={icon ?? 'spinner'} busy={busy} size={16} />}
      {label}
    </>
  );
  return (
    <button
      type="button"
      class={buttonClass('standard', { tone: action.tone, fill: action.fill })}
      disabled={action.disabled || busy}
      aria-busy={busy}
      onClick={action.onClick}
    >
      {alternate ? (
        <Swap
          second={alternate.shown}
          first={first}
          other={
            <>
              {alternate.icon && <Icon name={alternate.icon} size={16} />}
              {alternate.label}
            </>
          }
        />
      ) : (
        first
      )}
    </button>
  );
}

/** Rangée de la barre du bas : les boutons du site, en boutons standard, larges selon leur texte. */
export function SelectionActions({ actions }: { readonly actions: readonly SelectionAction[] }) {
  return (
    <>
      {actions.map((action) => (
        <ActionButton key={action.key} action={action} />
      ))}
    </>
  );
}
