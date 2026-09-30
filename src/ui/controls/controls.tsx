import { useEffect, useState } from 'preact/hooks';
import { injectStyle } from '@/core/dom';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';

// Le site n'a pas d'interrupteur : seul contrôle dessiné ici.
const SWITCH_CSS = `
.wm-switch { position: relative; flex: none; width: 40px; height: 22px; padding: 0; border-radius: 999px;
  border: 1px solid ${tokens.border}; background: ${tokens.surfaceLight}; cursor: pointer;
  transition: background 0.15s, border-color 0.15s; }
.wm-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
  border-radius: 50%; background: ${tokens.foreground}; opacity: 0.6; transition: transform 0.15s, opacity 0.15s; }
.wm-switch[aria-checked="true"] { background: ${tokens.accent}; border-color: ${tokens.accent}; }
.wm-switch[aria-checked="true"]::after { transform: translateX(18px); background: ${tokens.accentForeground}; opacity: 1; }
.wm-switch:disabled { opacity: 0.4; cursor: not-allowed; }
`;

export interface SwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: string;
  readonly disabled?: boolean;
}

/** Interrupteur (rôle `switch`, accessible au clavier). */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  injectStyle('ui-switch', SWITCH_CSS);
  return (
    <button
      type="button"
      role="switch"
      class="wm-switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

export interface ChoiceFieldProps {
  readonly value: number;
  readonly options: readonly { readonly value: number; readonly label: string }[];
  readonly onChange: (value: number) => void;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface CloseButtonProps {
  readonly onClick: () => void;
  readonly disabled?: boolean;
  /** Classes en plus, comme la position `siteClass.closeButtonPosition`. */
  readonly class?: string;
}

/** Croix de fermeture des modales : petit rond gris ghost. */
export function CloseButton({ onClick, disabled, class: extra }: CloseButtonProps) {
  const className = buttonClass('round', { fill: 'ghost', size: 'sm' });
  return (
    <button
      type="button"
      class={extra ? `${extra} ${className}` : className}
      aria-label="Fermer"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name="close" size={18} />
    </button>
  );
}

/** Une valeur parmi plusieurs : les pastilles des durées de la mise aux enchères du site. */
export function ChoiceField({ value, options, onChange, label, disabled }: ChoiceFieldProps) {
  return (
    <span class={siteClass.pills} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          class={`${siteClass.pill} ${option.value === value ? siteClass.pillActive : siteClass.pillIdle}`}
          aria-checked={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </span>
  );
}

export interface NumberFieldProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly unit?: string;
}

const bound = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Champ numérique du site (mise de départ) : − et + de chaque côté (d'un pas), valeur au centre.
 * La saisie au clavier est libre ; elle est bornée et enregistrée à la validation (Entrée ou sortie
 * du champ), une saisie invalide revient à la valeur actuelle.
 */
export function NumberField({ value, onChange, label, min, max, step = 1, unit }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const set = (next: number) => {
    const bounded = bound(Math.round(next * 1000) / 1000, min, max);
    setDraft(String(bounded));
    if (bounded !== value) onChange(bounded);
  };
  const commit = () => {
    const parsed = Number(draft.replace(',', '.'));
    if (draft.trim() === '' || !Number.isFinite(parsed)) setDraft(String(value));
    else set(parsed);
  };

  return (
    <span class={siteClass.stepper} style={{ width: '10rem' }}>
      <button
        type="button"
        class={`${siteClass.stepperButton} ${siteClass.stepperMinus}`}
        aria-label={`Diminuer : ${label}`}
        tabIndex={-1}
        disabled={value <= min}
        onClick={() => set(value - step)}
      >
        <Icon name="minus" size={16} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        class={siteClass.stepperInput}
        aria-label={label}
        value={draft}
        min={min}
        max={max}
        step={step}
        onInput={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />
      {unit && <span class={siteClass.stepperUnit}>{unit}</span>}
      <button
        type="button"
        class={`${siteClass.stepperButton} ${siteClass.stepperPlus}`}
        aria-label={`Augmenter : ${label}`}
        tabIndex={-1}
        disabled={value >= max}
        onClick={() => set(value + step)}
      >
        <Icon name="plus" size={16} />
      </button>
    </span>
  );
}
