import type { ComponentChildren } from 'preact';
import { injectStyle } from '@/core/dom';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';

const CSS = `
.wm-field-group { display: flex; flex-direction: column; gap: 0.375rem; }
.wm-range { display: flex; align-items: center; gap: 0.375rem; }
.wm-range > input { width: 6.5rem; height: ${tokens.fieldHeight}; }
.wm-range-unit { font-size: 0.75rem; opacity: 0.5; }
`;

/** Un contrôle sous son libellé (celui des champs du site), dans une rangée de filtres. */
export function FieldGroup({ label, children }: { readonly label: string; readonly children: ComponentChildren }) {
  injectStyle('ui-range-field', CSS);
  return (
    <div class="wm-field-group">
      <span class={siteClass.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

/** Entier positif ; vide ou illisible : sans borne. */
export function parseBound(text: string): number | undefined {
  const value = Number(text.replace(/\s/g, '').replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(value) || value < 0 ? undefined : Math.round(value);
}

export interface RangeFieldProps {
  /** Nom des champs : « Prix » donne « Prix minimum » et « Prix maximum ». */
  readonly label: string;
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly onChange: (min: number | undefined, max: number | undefined) => void;
  readonly unit?: string;
  /** Entrée dans un des champs (lancer la recherche). */
  readonly onEnter?: () => void;
}

/** Deux champs numériques du site, minimum puis maximum, et l'unité. */
export function RangeField({ label, min, max, onChange, unit, onEnter }: RangeFieldProps) {
  injectStyle('ui-range-field', CSS);
  return (
    <span class="wm-range">
      {([min, max] as const).map((value, index) => (
        <input
          key={index}
          type="number"
          inputMode="numeric"
          min={0}
          class={siteClass.textField}
          placeholder={index === 0 ? 'min' : 'max'}
          aria-label={`${label} ${index === 0 ? 'minimum' : 'maximum'}`}
          value={value ?? ''}
          onInput={(event) => {
            const bound = parseBound(event.currentTarget.value);
            if (index === 0) onChange(bound, max);
            else onChange(min, bound);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onEnter?.();
          }}
        />
      ))}
      {unit && <span class="wm-range-unit">{unit}</span>}
    </span>
  );
}
