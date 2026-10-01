/** Ambre sous 5 min, comme le site. */
const SOON_MS = 300_000;

type RemainingState = 'running' | 'soon' | 'ended';

const ENDED_TEXT = 'Terminée';

/** Secondes restantes, arrondies au-dessus : « 1s » jusqu'à la fin, « Terminée » à zéro. */
const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

export function remainingState(ms: number): RemainingState {
  if (secondsLeft(ms) === 0) return 'ended';
  return ms < SOON_MS ? 'soon' : 'running';
}

/** Temps restant court, l'unité la plus grande seule : « 3h », puis « 59min », puis « 59s », puis « Terminée ». */
export function formatShortRemaining(ms: number): string {
  const total = secondsLeft(ms);
  if (total === 0) return ENDED_TEXT;
  if (total >= 3600) return `${Math.floor(total / 3600)}h`;
  if (total >= 60) return `${Math.floor(total / 60)}min`;
  return `${total}s`;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Temps restant précis : « 2:07:28 », sous une heure « 00:07:46 », sous une minute « 00:00:09 ». */
export function formatPreciseRemaining(ms: number): string {
  const total = secondsLeft(ms);
  if (total === 0) return ENDED_TEXT;
  const hours = Math.floor(total / 3600);
  return `${hours > 0 ? String(hours) : '00'}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}
