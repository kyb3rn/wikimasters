import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { isPlainClick, prefersReducedMotion } from '@/core/dom';
import { buttonClass, type ButtonTone } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { alpha, layers, palette, tokens } from '@/ui/theme';
import { withLeaving, withoutToast, type ShownToast } from './leaving';
import type { Toast, ToastAction, ToastPosition, ToastStore, ToastVariant } from './store';

// Le site n'a pas de toasts : ceux-ci reprennent ses encarts teintés (celui du solde WB : bordure et halo de
// la couleur), sur son fond uni, avec sa palette Tailwind v4 (teinte 400 pour le texte et l'icône, 500 pour
// les bordures). Icône seule, en haut, comme la croix. Bouton d'action : petit, en contour, de la couleur du toast.
// Toast minuté : barre du temps restant en bas, arrêtée tant que le curseur est dessus (compte à rebours de la
// file arrêté en même temps, par le même état).
// Sortie : l'entrée à l'envers (fondu, 6 px vers le bas), puis la pile se referme sur sa place : une marge négative
// de sa hauteur et de l'écart, du côté où sont les toasts suivants (dessous en haut, dessus en bas).
const PALETTE: Record<ToastVariant, { text: string; tint: string }> = {
  error: { text: palette.red[400], tint: palette.red[500] },
  success: { text: palette.emerald[400], tint: palette.emerald[500] },
  warning: { text: palette.amber[400], tint: palette.amber[500] },
  info: { text: palette.sky[400], tint: palette.sky[500] },
};

/** Durée totale de la sortie : fondu, puis fermeture de la pile, qui commence avant la fin du fondu. */
const EXIT_MS = 300;
const GAP = 10;

/**
 * Distance du bas de l'écran pour la pile du bas (16 px) : un encart fixe posé en bas à droite (compteur des
 * historiques) la remonte au-dessus de lui en redéfinissant cette variable sur `body`.
 */
export const TOAST_BOTTOM_VAR = '--wm-toast-bottom';

const tint = (percent: number) => alpha('var(--wm-toast-tint)', percent);
const dim = (percent: number) => alpha(tokens.foreground, percent);

export const TOASTER_CSS = `
.wm-toaster { position: fixed; right: 16px; z-index: ${layers.toast}; display: flex; flex-direction: column; gap: ${GAP}px;
  width: min(360px, calc(100vw - 32px)); pointer-events: none; }
.wm-toaster[data-position="bottom-right"] { bottom: var(${TOAST_BOTTOM_VAR}, 16px); flex-direction: column-reverse; }
.wm-toast { position: relative; overflow: hidden; pointer-events: auto; display: flex; gap: 10px; align-items: flex-start; padding: 14px;
  background: ${tokens.surface}; border: 1px solid ${tint(25)}; border-radius: 16px;
  box-shadow: 0 12px 32px -8px rgb(0 0 0 / 60%), 0 0 30px -12px ${tint(45)};
  animation: wm-fade-in 0.18s ease-out; font-size: 13px; }
${(Object.keys(PALETTE) as ToastVariant[])
  .map((variant) => `.wm-toast[data-variant="${variant}"] { --wm-toast-color: ${PALETTE[variant].text}; --wm-toast-tint: ${PALETTE[variant].tint}; }`)
  .join('\n')}
/*
 * Même marge de 14 px tout autour. Icône (20 px) et croix (30 px) centrées sur la première ligne (18 px) sans la
 * rallonger : marges négatives de ce qu'elles dépassent ; croix tirée vers le bord de son vide intérieur (7 px).
 */
.wm-toast-icon { flex: none; display: flex; margin-block: -1px; color: var(--wm-toast-color); }
.wm-toast > .wm-button { margin: -6px -7px -6px 0; }
.wm-toast-body { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.wm-toast-title { font-size: 14px; font-weight: 600; line-height: 18px; }
.wm-toast-message { color: ${dim(90)}; line-height: 18px; }
.wm-toast-title + .wm-toast-message { margin-top: 2px; color: ${dim(60)}; }
.wm-toast-action { margin-top: 8px; }
.wm-toast-progress { position: absolute; inset: auto 0 0; height: 3px; background: ${tint(70)}; transform-origin: left;
  animation-name: wm-toast-progress; animation-timing-function: linear; animation-fill-mode: forwards; }
.wm-toast[data-paused] .wm-toast-progress { animation-play-state: paused; }
@keyframes wm-toast-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }
.wm-toast[data-leaving] { pointer-events: none; }
.wm-toaster[data-position="top-right"] .wm-toast[data-leaving] {
  animation: wm-toast-out 180ms ease-in forwards, wm-toast-close-below 160ms ease-in-out 140ms forwards; }
.wm-toaster[data-position="bottom-right"] .wm-toast[data-leaving] {
  animation: wm-toast-out 180ms ease-in forwards, wm-toast-close-above 160ms ease-in-out 140ms forwards; }
@keyframes wm-toast-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(6px); } }
@keyframes wm-toast-close-below { to { margin-bottom: calc(-1 * (var(--wm-toast-height) + ${GAP}px)); } }
@keyframes wm-toast-close-above { to { margin-top: calc(-1 * (var(--wm-toast-height) + ${GAP}px)); } }
`;

const ACTION_TONE: Record<ToastVariant, ButtonTone> = { error: 'danger', success: 'accent', warning: 'warning', info: 'info' };


export interface ToasterProps {
  readonly store: ToastStore;
  /** Distance du haut de l'écran pour la pile du haut (sous le solde du site). */
  readonly topOffset: () => number;
}

/** Les deux piles de toasts, abonnées à la file. */
export function Toaster({ store, topOffset }: ToasterProps) {
  const [shown, setShown] = useState<ShownToast[]>(() => store.list().map((toast) => ({ toast, leaving: false })));
  useEffect(
    () =>
      store.subscribe(() => {
        const animate = !prefersReducedMotion();
        setShown((previous) => withLeaving(previous, store.list(), animate));
      }),
    [store],
  );
  // Stable : un autre toast qui arrive pendant une sortie ne relance pas son minuteur.
  const gone = useCallback((id: number) => setShown((previous) => withoutToast(previous, id)), []);

  const stack = (position: ToastPosition) => {
    const items = shown.filter((item) => item.toast.position === position);
    if (items.length === 0) return null;
    const style = position === 'top-right' ? { top: `${topOffset()}px` } : undefined;
    return (
      <div class="wm-toaster" data-position={position} style={style}>
        {items.map(({ toast, leaving }) => (
          <ToastView key={toast.id} toast={toast} store={store} leaving={leaving} onGone={gone} />
        ))}
      </div>
    );
  };

  return (
    <>
      {stack('top-right')}
      {stack('bottom-right')}
    </>
  );
}

interface ToastViewProps {
  readonly toast: Toast;
  readonly store: ToastStore;
  readonly leaving: boolean;
  readonly onGone: (id: number) => void;
}

function ToastView({ toast, store, leaving, onGone }: ToastViewProps) {
  const [paused, setPaused] = useState(false);
  const element = useRef<HTMLDivElement>(null);

  // Hauteur relevée avant l'affichage suivant : la pile se referme d'autant.
  useLayoutEffect(() => {
    if (leaving) element.current?.style.setProperty('--wm-toast-height', `${element.current.offsetHeight}px`);
  }, [leaving]);
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => onGone(toast.id), EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving, onGone, toast.id]);

  const onClose = () => store.dismiss(toast.id);
  // Pointeur plutôt que souris : au doigt, la pause ne dure que le temps du toucher.
  const hover = (over: boolean) => {
    if (toast.durationMs === undefined) return;
    if (over) store.pause(toast.id);
    else store.resume(toast.id);
    setPaused(over);
  };

  return (
    <div
      ref={element}
      class="wm-toast"
      data-variant={toast.variant}
      data-paused={paused || undefined}
      data-leaving={leaving || undefined}
      aria-hidden={leaving || undefined}
      inert={leaving}
      role={toast.variant === 'error' ? 'alert' : 'status'}
      onPointerEnter={() => hover(true)}
      onPointerLeave={() => hover(false)}
    >
      <span class="wm-toast-icon" aria-hidden="true">
        <Icon name={toast.variant} size={20} />
      </span>
      <div class="wm-toast-body">
        {toast.title && <div class="wm-toast-title">{toast.title}</div>}
        <div class="wm-toast-message">{toast.message}</div>
        {toast.action && <ActionView action={toast.action} variant={toast.variant} onClose={onClose} />}
      </div>
      <button type="button" class={buttonClass('round', { fill: 'ghost', size: 'sm' })} aria-label="Fermer" onClick={onClose}>
        <Icon name="close" size={16} />
      </button>
      {toast.durationMs !== undefined && (
        <span class="wm-toast-progress" aria-hidden="true" style={{ animationDuration: `${toast.durationMs}ms` }} />
      )}
    </div>
  );
}

interface ActionViewProps {
  readonly action: ToastAction;
  readonly variant: ToastVariant;
  readonly onClose: () => void;
}

/**
 * Bouton d'action du toast, qui le ferme. Avec une page, c'est un vrai lien : Ctrl, Maj ou le clic du milieu
 * l'ouvrent dans un autre onglet par le navigateur ; un clic simple garde la navigation du site.
 */
function ActionView({ action, variant, onClose }: ActionViewProps) {
  const className = `${buttonClass('standard', { tone: ACTION_TONE[variant], size: 'sm' })} wm-toast-action`;
  if (action.href === undefined) {
    return (
      <button
        type="button"
        class={className}
        onClick={() => {
          onClose();
          action.onClick();
        }}
      >
        {action.label}
      </button>
    );
  }
  const openedElsewhere = () => {
    onClose();
    action.onOpenElsewhere?.();
  };
  return (
    <a
      href={action.href}
      class={className}
      onClick={(event) => {
        if (!isPlainClick(event)) {
          openedElsewhere();
          return;
        }
        event.preventDefault();
        onClose();
        action.onClick();
      }}
      onAuxClick={(event) => {
        if (event.button === 1) openedElsewhere();
      }}
    >
      {action.label}
    </a>
  );
}
