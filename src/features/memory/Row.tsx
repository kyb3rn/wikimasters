import { useState } from 'preact/hooks';
import type { DataItem } from '@/core/data';
import { ageText, formatTime } from '@/services/market';
import type { ConfirmStep } from '@/services/site-confirm';
import { parseRarity, RARITY_NAMES, rarityBadgeStyle } from '@/site/rarity';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { formatBytes } from './list';

/** Date complète, au survol de l'âge. */
const fullDate = (time: number) => `${new Date(time).toLocaleDateString('fr-FR')} à ${formatTime(time)}`;

export interface DeleteButtonProps {
  readonly step: ConfirmStep<string>;
  readonly target: string;
  /** Ce qui est supprimé, pour l'info-bulle (« Rome antique »). */
  readonly name: string;
  readonly onDelete: () => Promise<void>;
}

/** Corbeille en deux clics (« Confirmer ? »), roue pendant la suppression. */
export function DeleteButton({ step, target, name, onDelete }: DeleteButtonProps) {
  const [busy, setBusy] = useState(false);
  const stage = step.stage(target);
  if (stage === 'idle' && !busy) {
    return (
      <button
        type="button"
        class={buttonClass('round', { size: 'sm', tone: 'danger', fill: 'ghost' })}
        title="Supprimer"
        aria-label={`Supprimer « ${name} »`}
        onClick={() => step.press(target)}
      >
        <Icon name="trash" size={14} />
      </button>
    );
  }
  return (
    <button
      type="button"
      class={buttonClass('standard', { size: 'sm', tone: 'danger', fill: 'solid' })}
      disabled={stage === 'waiting' || busy}
      aria-busy={busy}
      onClick={() => {
        if (!step.press(target)) return;
        setBusy(true);
        void onDelete().finally(() => setBusy(false));
      }}
    >
      {busy && <Icon name="trash" size={14} busy />}
      Confirmer ?
    </button>
  );
}

export interface RowProps {
  readonly item: DataItem;
  /** Case de sélection : `undefined` sans colonne de cases. */
  readonly selected?: boolean;
  readonly onSelect?: (selected: boolean) => void;
  /** Colonne du dépliage : `undefined` sans colonne ; sinon ouvert ou non (élément avec des entrées). */
  readonly expanded?: boolean;
  readonly onExpand?: () => void;
  /** Mise en vente d'une carte, sous elle. */
  readonly child?: boolean;
  readonly onOpen?: () => void;
  /** Absent : rien ne se supprime. */
  readonly onDelete?: () => Promise<void>;
  readonly step: ConfirmStep<string>;
}

/** Une ligne : case, dépliage, titre (badge de rareté), faits, âge, taille, corbeille. */
export function Row({ item, selected, onSelect, expanded, onExpand, child = false, onOpen, onDelete, step }: RowProps) {
  const rarity = parseRarity(item.rarity);
  return (
    <li class="wm-memory-row" data-key={item.key} data-child={child ? '' : undefined}>
      {selected !== undefined && (
        <input
          type="checkbox"
          class="wm-memory-check"
          checked={selected}
          aria-label={`Choisir « ${item.title} »`}
          onChange={(event) => onSelect?.(event.currentTarget.checked)}
        />
      )}
      {expanded !== undefined &&
        (item.children && item.children.length > 0 ? (
          <button
            type="button"
            class={buttonClass('round', { size: 'xs', fill: 'ghost' })}
            aria-expanded={expanded}
            aria-label={expanded ? 'Replier' : 'Déplier'}
            title={expanded ? 'Replier' : 'Déplier'}
            onClick={onExpand}
          >
            <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} />
          </button>
        ) : (
          <span class="wm-memory-spacer" />
        ))}
      <div class="wm-memory-main">
        <div class="wm-memory-title">
          {rarity && (
            <span class={siteClass.rarityBadge} style={rarityBadgeStyle(rarity)} title={`${RARITY_NAMES[rarity]}${item.shiny ? ' shiny' : ''}`}>
              {rarity}
              {item.shiny && '✦'}
            </span>
          )}
          {onOpen ? (
            <button type="button" class="wm-memory-open" title="Ouvrir" onClick={onOpen}>
              {item.title}
            </button>
          ) : (
            <span class="wm-memory-name">{item.title}</span>
          )}
        </div>
        {item.details && item.details.length > 0 && <div class="wm-memory-details">{item.details.join(' · ')}</div>}
      </div>
      <span
        class="wm-memory-date"
        data-stale={item.stale ? '' : undefined}
        title={item.date === undefined ? undefined : `${fullDate(item.date)}${item.stale ? ' (à recharger)' : ''}`}
      >
        {item.date === undefined ? '—' : ageText(item.date)}
      </span>
      <span class="wm-memory-size">{formatBytes(item.bytes)}</span>
      <span class="wm-memory-actions">
        {onDelete && <DeleteButton step={step} target={item.key} name={item.title} onDelete={onDelete} />}
      </span>
    </li>
  );
}
