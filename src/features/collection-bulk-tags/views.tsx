import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import type { PendingTag } from './pending';

export interface PendingChipsProps {
  readonly tags: readonly PendingTag[];
  readonly busy: boolean;
  readonly onRemove: (tag: PendingTag) => void;
}

/** Étiquettes choisies, au-dessus du champ : pastilles de la modale de carte, croix pour en enlever une. */
export function PendingChips({ tags, busy, onRemove }: PendingChipsProps) {
  return (
    <div class={siteClass.tagChips}>
      {tags.map((tag) => (
        <span
          key={tag.id ?? `new:${tag.name}`}
          class={siteClass.tagChip}
          style={tag.chipStyle}
          title={tag.id === undefined ? 'Nouvelle étiquette, créée à l’envoi' : undefined}
        >
          {tag.name}
          <button type="button" class={siteClass.tagChipRemove} aria-label={`Enlever ${tag.name}`} disabled={busy} onClick={() => onRemove(tag)}>
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export interface SubmitButtonProps {
  readonly label: string;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
}

export function SubmitButton({ label, busy, disabled, onClick }: SubmitButtonProps) {
  return (
    <button type="button" class={siteClass.wideButton} disabled={busy || disabled} aria-busy={busy} onClick={onClick}>
      {busy && <Icon name="spinner" size={16} class="wm-spin" />}
      {label}
    </button>
  );
}
