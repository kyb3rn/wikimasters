import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { BATCH_LIMIT, CONCURRENCY } from './batch';

export interface LoadPricesButtonProps {
  /** Cartes affichées dont les ventes sont absentes ou périmées ; cache pas encore lu : `undefined`. */
  readonly pending: number | undefined;
  /** Chargement en cours : cartes demandées sur le total. */
  readonly progress: { readonly done: number; readonly total: number } | undefined;
  /** Minute pleine : secondes avant la remise à zéro du compteur. */
  readonly waitSeconds: number | undefined;
  readonly onClick: () => void;
}

const LIMIT_TEXT = `${BATCH_LIMIT} historiques par minute au plus (le site refuse au-delà de 30)`;

/** « Charger les prix (n) » au bout de la ligne des filtres ; roue et progression pendant le chargement. */
export function LoadPricesButton({ pending, progress, waitSeconds, onClick }: LoadPricesButtonProps) {
  const waiting = waitSeconds !== undefined && pending !== 0;
  const label = progress
    ? `Chargement… ${progress.done} / ${progress.total}`
    : waiting
      ? `Limite atteinte · ${waitSeconds} s`
      : pending === 0
        ? 'Prix à jour'
        : `Charger les prix${pending === undefined ? '' : ` (${pending})`}`;
  const title = progress
    ? `Chargement des prix, ${CONCURRENCY} à la fois au plus : ${LIMIT_TEXT}.`
    : waiting
      ? `Limite des historiques atteinte pour cette minute : de nouveau possible dans ${waitSeconds} s.`
      : pending === 0
        ? 'Les prix des cartes affichées sont tous récents.'
        : `Charger les prix absents ou anciens des cartes affichées, ${CONCURRENCY} à la fois au plus : ${LIMIT_TEXT}.`;
  return (
    <button
      type="button"
      class={buttonClass('standard', { tone: 'accent' })}
      disabled={progress !== undefined || waiting || !pending}
      aria-busy={progress !== undefined}
      title={title}
      onClick={onClick}
    >
      <Icon name="reload" busy={progress !== undefined} />
      {label}
    </button>
  );
}
