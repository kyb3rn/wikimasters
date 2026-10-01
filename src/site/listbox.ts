import { isRecord } from '@/core/guards';
import { findPropsAbove } from '@/core/react';

/**
 * Liste déroulante à lui du site (Collection, Toutes les cartes ; code du 29/09/2026) : bouton
 * `aria-haspopup="listbox"` dont le composant reçoit `{ ariaLabel, value, options, onChange }` ; son menu est
 * rendu dans `body` tant qu'il est ouvert. `onChange` avec la valeur déjà affichée ne relance rien.
 */
export interface SiteListbox {
  readonly ariaLabel: string;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  /** Ce que fait la page au choix d'une option. */
  onChange(value: string): void;
}

/** Composant de la liste dont `button` est le bouton, lu dans l'arbre React affiché. */
export function findListbox(button: HTMLButtonElement): SiteListbox | undefined {
  const ariaLabel = button.getAttribute('aria-label');
  if (!ariaLabel) return undefined;
  const props = findPropsAbove(
    button,
    (candidate) => candidate.ariaLabel === ariaLabel && typeof candidate.onChange === 'function',
  )?.props;
  if (!props) return undefined;
  const onChange = props.onChange as (value: string) => void;
  const options = (Array.isArray(props.options) ? props.options : []).flatMap((option: unknown) =>
    isRecord(option) && typeof option.value === 'string'
      ? [{ value: option.value, label: typeof option.label === 'string' ? option.label : '' }]
      : [],
  );
  return { ariaLabel, value: typeof props.value === 'string' ? props.value : '', options, onChange: (value) => onChange(value) };
}

/**
 * Change un `<select>` natif contrôlé par React comme le ferait l'utilisateur : setter natif (React ignore une
 * simple affectation), puis l'événement `change` qu'il écoute.
 */
export function chooseSelectValue(select: HTMLSelectElement, value: string): void {
  if (select.value === value) return;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}
