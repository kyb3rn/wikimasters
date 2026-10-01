import type { ComponentChildren } from 'preact';
import type { ConfirmStage } from '@/services/site-confirm';
import { buttonClass } from '@/ui/button';
import { Icon, type IconName } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { selectedLabel } from './label';

export interface ToggleProps {
  readonly active: boolean;
  /** Cartes sélectionnées (en sélection seulement). */
  readonly count: number;
  readonly onClick: () => void;
}

/** Au bout de la ligne des filtres : « n sélectionnées » (en sélection), puis le bouton du mode. */
export function SelectionToggle({ active, count, onClick }: ToggleProps) {
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
        onClick={onClick}
      >
        <Icon name="select" size={18} />
      </button>
    </>
  );
}

export interface SiteAction {
  readonly label: string;
  readonly disabled: boolean;
}

export interface ActionsProps {
  readonly selectPage: { readonly disabled: boolean; readonly pageSelected: boolean } | undefined;
  readonly tag: SiteAction | undefined;
  readonly untag: SiteAction | undefined;
  readonly discard: { readonly disabled: boolean; readonly stage: ConfirmStage; readonly busy: boolean } | undefined;
  readonly onSelectPage: () => void;
  readonly onTag: () => void;
  readonly onUntag: () => void;
  readonly onDiscard: () => void;
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

function Action({ action, icon, onClick }: { readonly action: SiteAction; readonly icon: IconName; readonly onClick: () => void }) {
  return (
    <button type="button" class={buttonClass('standard')} disabled={action.disabled} onClick={onClick}>
      <Icon name={icon} size={16} />
      {action.label}
    </button>
  );
}

/** Rangée de la barre du bas : les boutons du site, en boutons standard, larges selon leur texte. */
export function SelectionActions(props: ActionsProps) {
  const { selectPage, tag, untag, discard } = props;
  const asking = discard !== undefined && discard.stage !== 'idle' && !discard.busy;
  return (
    <>
      {selectPage && (
        <button type="button" class={buttonClass('standard')} disabled={selectPage.disabled} onClick={props.onSelectPage}>
          <Swap
            second={selectPage.pageSelected}
            first={
              <>
                <Icon name="select" size={16} />
                Sélectionner toute la page
              </>
            }
            other={
              <>
                <Icon name="square" size={16} />
                Désélectionner la page
              </>
            }
          />
        </button>
      )}
      {tag && <Action action={tag} icon="tag" onClick={props.onTag} />}
      {untag && <Action action={untag} icon="tag" onClick={props.onUntag} />}
      {discard && (
        <button
          type="button"
          class={buttonClass('standard', { tone: 'danger', fill: asking ? 'solid' : 'outline' })}
          disabled={discard.disabled || discard.busy || discard.stage === 'waiting'}
          aria-busy={discard.busy}
          onClick={props.onDiscard}
        >
          <Swap
            second={asking}
            first={
              <>
                <Icon name="trash" busy={discard.busy} size={16} />
                Défausser tout
              </>
            }
            other="Confirmer ?"
          />
        </button>
      )}
    </>
  );
}
