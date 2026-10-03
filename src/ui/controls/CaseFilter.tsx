import { injectStyle } from '@/core/dom';
import { Icon, type IconName } from '@/ui/icons';
import { cx } from '@/ui/cx';
import { siteClass } from '@/ui/site';
import { alpha, tokens } from '@/ui/theme';
import { CountBadge } from './controls';

/*
 * Case cochée : bordure intérieure et texte de la couleur de l'option (`--wm-case`, posée sur chaque case ; l'accent
 * sans couleur propre), sans fond ; au survol, cochée ou non, fond de cette couleur, léger. La première reprend
 * l'arrondi du cadre (moins sa bordure), sinon il rognerait les coins de la bordure intérieure.
 */
const css = () => `
.wm-case-filter > .wm-case { color: ${alpha(tokens.foreground, 60, 'srgb')}; background-color: transparent;
  white-space: nowrap; transition: color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease; }
.wm-case-filter > .wm-case:hover { color: ${tokens.foreground};
  background-color: ${alpha('var(--wm-case)', 15, 'srgb')}; }
.wm-case-filter > .wm-case[aria-pressed="true"] { color: var(--wm-case); box-shadow: inset 0 0 0 2px var(--wm-case); }
.wm-case-filter > .wm-case:first-child { border-radius: calc(var(--radius-lg, 0.5rem) - 1px) 0 0 calc(var(--radius-lg, 0.5rem) - 1px); }
.wm-case-face { position: relative; display: inline-flex; }
.wm-case-face > .wm-case-badge { top: -10px; right: -12px; }
`;

export interface CaseOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** Icône seule à la place du libellé, qui devient le nom et l'info-bulle de la case. */
  readonly icon?: IconName;
  /** Info-bulle (le nom complet d'une abréviation). */
  readonly title?: string;
  /** Pastille rouge du nombre (non lues), sur le coin haut droit de l'icône ou du libellé, sans déborder de la case. */
  readonly badge?: number;
  /** Couleur de la case cochée ; l'accent par défaut. */
  readonly color?: string;
}

export interface CaseFilterProps<T extends string> {
  readonly label: string;
  readonly options: readonly CaseOption<T>[];
  readonly checked: ReadonlySet<T>;
  readonly onToggle: (value: T) => void;
  /** Décoche tout (croix finale, inactive quand rien n'est coché). */
  readonly onReset: () => void;
  /** Nom de la croix (« Décocher toutes les raretés »). */
  readonly resetLabel?: string;
  /** Classes du cadre et de chaque case (repères propres à un usage). */
  readonly class?: string;
  readonly caseClass?: string;
}

/** Cases collées à la hauteur des champs (raretés de la Collection, filtres d'une liste), puis une croix qui décoche tout. */
export function CaseFilter<T extends string>({ label, options, checked, onToggle, onReset, resetLabel = `Tout décocher : ${label}`, class: extra, caseClass }: CaseFilterProps<T>) {
  injectStyle('ui-case-filter', css());
  return (
    <div class={cx(siteClass.fieldSegmented, 'wm-case-filter', extra)} style={{ height: tokens.fieldHeight }} role="group" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          class={cx(siteClass.fieldSegment, index > 0 && siteClass.segmentSeparator, 'wm-case', caseClass)}
          style={{ '--wm-case': option.color ?? tokens.accent }}
          aria-pressed={checked.has(option.value)}
          aria-label={option.icon && option.label}
          title={option.title ?? (option.icon && option.label)}
          onClick={() => onToggle(option.value)}
        >
          <span class="wm-case-face">
            {option.icon ? <Icon name={option.icon} size={18} /> : option.label}
            <CountBadge count={option.badge ?? 0} class="wm-case-badge" />
          </span>
        </button>
      ))}
      <button
        type="button"
        class={cx(siteClass.fieldSegment, siteClass.segmentSeparator, siteClass.fieldSegmentIdle, siteClass.fadedWhenDisabled)}
        disabled={checked.size === 0}
        aria-label={resetLabel}
        title={resetLabel}
        onClick={onReset}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
