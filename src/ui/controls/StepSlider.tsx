import { injectStyle } from '@/core/dom';
import { alpha, tokens } from '@/ui/theme';
import type { ChoiceFieldProps } from './controls';

/** Diamètre du curseur : les crans et leurs libellés sont placés sur son centre. */
const THUMB = 18;
/** Piste vide : visible sur le fond des cadres, où `surfaceLight` se confond. */
const TRACK = alpha(tokens.foreground, 16, 'srgb');

// Le site n'a pas de curseur : dessiné ici, aux couleurs de son thème. La part remplie de la piste s'arrête
// au centre du curseur (`--wm-step`, de 0 à 1).
const CSS = `
.wm-step-slider { position: relative; display: block; flex: 1; width: 100%; min-width: 16rem; padding: 0 10px 22px; }
.wm-step-slider input { display: block; width: 100%; height: ${THUMB + 4}px; margin: 0; padding: 0; background: none;
  -webkit-appearance: none; appearance: none; cursor: pointer; }
.wm-step-slider input:disabled { cursor: not-allowed; opacity: 0.5; }
.wm-step-slider input:focus { outline: none; }
.wm-step-slider input::-webkit-slider-runnable-track { height: 6px; border-radius: 999px; background: linear-gradient(to right,
  ${tokens.accent} calc(${THUMB / 2}px + (100% - ${THUMB}px) * var(--wm-step)),
  ${TRACK} calc(${THUMB / 2}px + (100% - ${THUMB}px) * var(--wm-step))); }
.wm-step-slider input::-webkit-slider-thumb { -webkit-appearance: none; width: ${THUMB}px; height: ${THUMB}px;
  margin-top: ${(6 - THUMB) / 2}px; border: 0; border-radius: 50%; background: ${tokens.accent};
  box-shadow: 0 1px 4px rgb(0 0 0 / 45%); transition: transform 0.15s; }
.wm-step-slider input::-moz-range-track { height: 6px; border-radius: 999px; background: ${TRACK}; }
.wm-step-slider input::-moz-range-progress { height: 6px; border-radius: 999px; background: ${tokens.accent}; }
.wm-step-slider input::-moz-range-thumb { width: ${THUMB}px; height: ${THUMB}px; border: 0; border-radius: 50%;
  background: ${tokens.accent}; box-shadow: 0 1px 4px rgb(0 0 0 / 45%); transition: transform 0.15s; }
.wm-step-slider input:not(:disabled):hover::-webkit-slider-thumb { transform: scale(1.12); }
.wm-step-slider input:not(:disabled):hover::-moz-range-thumb { transform: scale(1.12); }
.wm-step-slider input:focus-visible::-webkit-slider-thumb { outline: 2px solid ${tokens.foreground}; outline-offset: 2px; }
.wm-step-slider input:focus-visible::-moz-range-thumb { outline: 2px solid ${tokens.foreground}; outline-offset: 2px; }
.wm-step-slider-ticks { position: absolute; left: ${10 + THUMB / 2}px; right: ${10 + THUMB / 2}px; bottom: 0; height: 18px; }
.wm-step-slider-tick { position: absolute; top: 0; transform: translateX(-50%); padding-top: 5px; font-size: 11px;
  line-height: 13px; white-space: nowrap; opacity: 0.55; cursor: pointer; transition: opacity 0.15s, color 0.15s; }
.wm-step-slider-tick::before { content: ''; position: absolute; top: 0; left: 50%; width: 1px; height: 3px;
  background: currentColor; }
.wm-step-slider-tick:hover { opacity: 0.85; }
.wm-step-slider-tick[data-active] { opacity: 1; font-weight: 600; color: ${tokens.accent}; }
.wm-step-slider[data-disabled] .wm-step-slider-tick { cursor: not-allowed; }
`;

/** Touches qui passent au cran voisin (le pas du navigateur ne tomberait pas sur les crans). */
const KEY_STEPS: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowUp: 1,
  PageUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  PageDown: -1,
};

/**
 * Une valeur parmi plusieurs, en curseur cranté : un cran par option (options croissantes), placé selon sa
 * valeur entre la première et la dernière. Le curseur saute au cran le plus proche (glissé, clic sur la piste
 * ou sur un libellé) ; au clavier, d'un cran à l'autre. Chaque cran changé est transmis aussitôt.
 */
export function StepSlider({ value, options, onChange, label, disabled }: ChoiceFieldProps) {
  injectStyle('ui-step-slider', CSS);
  const min = options[0]?.value ?? 0;
  const max = options.at(-1)?.value ?? min;
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const position = (v: number) => (max === min ? 0 : (v - min) / (max - min));
  const nearest = (target: number) => {
    let best = 0;
    options.forEach((option, i) => {
      if (Math.abs(option.value - target) < Math.abs((options[best]?.value ?? min) - target)) best = i;
    });
    return best;
  };
  const select = (i: number) => {
    const option = options[i];
    if (!disabled && option && option.value !== value) onChange(option.value);
  };

  return (
    <span class="wm-step-slider" data-disabled={disabled || undefined}>
      <input
        type="range"
        min={min}
        max={max}
        step="any"
        value={options[index]?.value ?? min}
        style={`--wm-step: ${position(options[index]?.value ?? min)}`}
        aria-label={label}
        aria-valuetext={options[index]?.label}
        disabled={disabled}
        onInput={(event) => {
          const input = event.currentTarget;
          const i = nearest(Number(input.value));
          // Le navigateur a mis le curseur sous le pointeur : ramené tout de suite sur le cran, même inchangé.
          input.value = String(options[i]?.value ?? min);
          select(i);
        }}
        onKeyDown={(event) => {
          const step = KEY_STEPS[event.key];
          const target =
            event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : step === undefined ? undefined : index + step;
          if (target === undefined) return;
          event.preventDefault();
          select(Math.min(options.length - 1, Math.max(0, target)));
        }}
      />
      <span class="wm-step-slider-ticks" aria-hidden="true">
        {options.map((option, i) => (
          <span
            key={option.value}
            class="wm-step-slider-tick"
            data-active={i === index || undefined}
            style={`left: ${position(option.value) * 100}%`}
            onClick={() => select(i)}
          >
            {option.label}
          </span>
        ))}
      </span>
    </span>
  );
}
