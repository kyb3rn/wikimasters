import type { ComponentChild } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ProBadge, showProOffer } from '@/services/market';
import {
  BUTTON_FILLS,
  BUTTON_SIZES,
  BUTTON_TONES,
  buttonClass,
  type ButtonFill,
  type ButtonShape,
  type ButtonSize,
  type ButtonTone,
} from '@/ui/button';
import { Icon, type IconName } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { DEMO_CARD } from './demo';
import { DEMO_BUSY_MS, Group, Matrix, Specimen, useBusy } from './layout';

/** Libellé et icône d'exemple de chaque couleur. */
const SAMPLES: Readonly<Record<ButtonTone, { readonly label: string; readonly icon: IconName }>> = {
  neutral: { label: 'Actualiser', icon: 'reload' },
  danger: { label: 'Défausser', icon: 'trash' },
  info: { label: 'Détails', icon: 'info' },
  accent: { label: 'Valider', icon: 'check' },
  warning: { label: 'Attention', icon: 'warning' },
  pro: { label: 'Débloquer', icon: 'sparkles' },
};

interface Variant {
  readonly tone: ButtonTone;
  readonly fill: ButtonFill;
}

/** Chaque couleur pleine, en contour, puis en ghost. */
const variants = (): readonly Variant[] => BUTTON_TONES.flatMap((tone) => BUTTON_FILLS.map((fill) => ({ tone, fill })));

const ICON_SIZES: Readonly<Record<ButtonSize, readonly [text: number, alone: number]>> = { lg: [18, 22], md: [16, 20], sm: [14, 16], xs: [12, 12] };

/** Icône d'un bouton à texte, ou seule (carré, rond). */
const iconSize = (shape: ButtonShape, size: ButtonSize) => ICON_SIZES[size][shape === 'square' || shape === 'round' ? 1 : 0];

interface SampleProps {
  readonly class: string;
  readonly icon: IconName;
  readonly iconSize: number;
  readonly label?: string;
}

/** Bouton qui fait tourner sa roue un moment quand on le clique, comme pendant une requête. */
function BusyButton({ class: className, icon, iconSize: size, label }: SampleProps) {
  const [busy, run] = useBusy();
  return (
    <button type="button" class={className} disabled={busy} aria-busy={busy} aria-label={label ? undefined : icon} onClick={run}>
      <Icon name={icon} size={size} busy={busy} />
      {label}
    </button>
  );
}

/** Désactivé, ou en cours (`busy`) : roue à la place de l'icône. */
function InactiveButton({ class: className, icon, iconSize: size, label, busy }: SampleProps & { readonly busy?: boolean }) {
  return (
    <button type="button" class={className} disabled aria-busy={busy} aria-label={label ? undefined : icon}>
      <Icon name={icon} size={size} busy={busy} />
      {label}
    </button>
  );
}

/** Délais de « Défausser tout » (collection-selection) : « Confirmer ? » inactif, puis actif. */
const CONFIRM_WAIT_MS = 750;
const CONFIRM_OPEN_MS = 3500;

type Stage = 'idle' | 'waiting' | 'asking' | 'busy';

/** « Défausser tout » en deux clics, avec les délais de la sélection : rouge en contour, puis plein. */
function TwoStepDiscard() {
  const [stage, setStage] = useState<Stage>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const schedule = (ms: number, then: () => void) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(then, ms);
  };
  const onClick = () => {
    if (stage === 'idle') {
      setStage('waiting');
      schedule(CONFIRM_WAIT_MS, () => {
        setStage('asking');
        schedule(CONFIRM_OPEN_MS, () => setStage('idle'));
      });
    } else if (stage === 'asking') {
      setStage('busy');
      schedule(DEMO_BUSY_MS, () => setStage('idle'));
    }
  };
  const asking = stage === 'waiting' || stage === 'asking';
  return (
    <button
      type="button"
      class={`${buttonClass('standard', { tone: 'danger', fill: asking ? 'solid' : 'outline' })} wm-showcase-two-step`}
      disabled={stage === 'waiting' || stage === 'busy'}
      aria-busy={stage === 'busy'}
      onClick={onClick}
    >
      {asking ? (
        'Confirmer ?'
      ) : (
        <>
          <Icon name="trash" size={16} busy={stage === 'busy'} />
          Défausser tout
        </>
      )}
    </button>
  );
}

/** Son des paquets : ghost vert allumé, gris éteint. */
function SoundToggle() {
  const [on, setOn] = useState(true);
  return (
    <button
      type="button"
      class={buttonClass('round', { tone: on ? 'accent' : 'neutral', fill: 'ghost' })}
      aria-label="Son"
      aria-pressed={on}
      onClick={() => setOn(!on)}
    >
      <Icon name={on ? 'volume' : 'volumeOff'} size={18} />
    </button>
  );
}

/** Boutons réels propres à une variante, après ses états. */
function extras(shape: ButtonShape, { tone, fill }: Variant): ComponentChild[] {
  const is = (t: ButtonTone, f: ButtonFill) => tone === t && fill === f;
  if (shape === 'standard' && is('neutral', 'outline')) {
    return [
      <button type="button" class={`${buttonClass('standard')} ${siteClass.proBadgeHost}`} onClick={() => showProOffer(DEMO_CARD)}>
        <Icon name="market" size={16} />
        Marché
        <ProBadge />
      </button>,
    ];
  }
  if (shape === 'standard' && is('danger', 'outline')) return [<TwoStepDiscard />];
  if (shape === 'round' && is('accent', 'ghost')) return [<SoundToggle />];
  return [];
}

type Frame = (button: ComponentChild, size: ButtonSize) => ComponentChild;

/** États d'une variante dans une taille : normal (cliquable), icône seule (standard), désactivé, en cours. */
function states(shape: ButtonShape, variant: Variant, size: ButtonSize, frame: Frame, pill: boolean): ComponentChild[] {
  const className = buttonClass(shape, { ...variant, size, pill });
  const sample = { class: className, icon: SAMPLES[variant.tone].icon, iconSize: iconSize(shape, size) };
  const label = shape === 'square' || shape === 'round' ? undefined : SAMPLES[variant.tone].label;
  return [
    frame(<BusyButton {...sample} label={label} />, size),
    ...(shape === 'standard' ? [frame(<BusyButton {...sample} />, size)] : []),
    frame(<InactiveButton {...sample} label={label} />, size),
    frame(<InactiveButton {...sample} label={label} busy />, size),
  ];
}

interface ShapeMatrixProps {
  readonly shape: ButtonShape;
  readonly frame?: Frame;
  /** Bords arrondis à 100 %, sans les boutons réels de la forme d'origine. */
  readonly pill?: boolean;
}

/** Une forme dans toutes ses variantes : une rangée par couleur et remplissage, chaque taille en colonnes. */
function ShapeMatrix({ shape, frame = (button) => button, pill = false }: ShapeMatrixProps) {
  return (
    <Matrix
      rows={variants().map((variant) => [
        ...BUTTON_SIZES.flatMap((size, index) => [...(index > 0 ? [null] : []), ...states(shape, variant, size, frame, pill)]),
        ...(pill ? [] : [null, ...extras(shape, variant)]),
      ])}
    />
  );
}

const WINDOW_WIDTH: Readonly<Record<ButtonSize, string>> = { lg: '13rem', md: '11rem', sm: '9rem', xs: '7rem' };
const WIDE_WIDTH: Readonly<Record<ButtonSize, string>> = { lg: '17rem', md: '14rem', sm: '11rem', xs: '9rem' };

/** Bouton de fenêtre : il y prend la moitié d'une rangée Annuler · action. */
const windowFrame: Frame = (button, size) => (
  <div class={siteClass.confirmActions} style={{ width: WINDOW_WIDTH[size] }}>
    {button}
  </div>
);

const wideFrame: Frame = (button, size) => <Specimen width={WIDE_WIDTH[size]}>{button}</Specimen>;

/** Un groupe par forme de bouton (les longues aussi arrondies) ; dans chacun, toutes les couleurs, remplissages et tailles. */
export function Buttons() {
  return (
    <>
      <Group title="Standard">
        <ShapeMatrix shape="standard" />
      </Group>
      <Group title="Standard arrondi">
        <ShapeMatrix shape="standard" pill />
      </Group>
      <Group title="Fenêtre">
        <ShapeMatrix shape="window" frame={windowFrame} />
      </Group>
      <Group title="Fenêtre arrondie">
        <ShapeMatrix shape="window" frame={windowFrame} pill />
      </Group>
      <Group title="Pleine largeur">
        <ShapeMatrix shape="wide" frame={wideFrame} />
      </Group>
      <Group title="Pleine largeur arrondie">
        <ShapeMatrix shape="wide" frame={wideFrame} pill />
      </Group>
      <Group title="Carré">
        <ShapeMatrix shape="square" />
      </Group>
      <Group title="Rond">
        <ShapeMatrix shape="round" />
      </Group>
    </>
  );
}
