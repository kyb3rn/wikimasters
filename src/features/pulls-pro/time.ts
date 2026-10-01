/** Le pack du jour revient à minuit, heure française. */
export const RESET_TIME_ZONE = 'Europe/Paris';

const formats = new Map<string, Intl.DateTimeFormat>();

function wallClock(instant: number, timeZone: string) {
  let format = formats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    });
    formats.set(timeZone, format);
  }
  const parts: Record<string, number> = {};
  for (const part of format.formatToParts(instant)) parts[part.type] = Number(part.value);
  return {
    year: parts.year ?? 1970,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    utc: Date.UTC(parts.year ?? 1970, (parts.month ?? 1) - 1, parts.day ?? 1, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0),
  };
}

/** Décalage du fuseau à cet instant (heure affichée − UTC), à la seconde près. */
function zoneOffset(instant: number, timeZone: string): number {
  return wallClock(instant, timeZone).utc - Math.floor(instant / 1000) * 1000;
}

/** Prochain minuit dans ce fuseau (jours de 23 ou 25 h compris : l'heure d'été change à 2 h ou 3 h). */
export function nextMidnight(now: number, timeZone: string = RESET_TIME_ZONE): number {
  const { year, month, day } = wallClock(now, timeZone);
  const target = Date.UTC(year, month - 1, day + 1);
  const guess = target - zoneOffset(now, timeZone);
  return target - zoneOffset(guess, timeZone);
}

/** Minuit qui termine ce jour (« 2026-09-30 ») dans ce fuseau. */
export function midnightAfter(date: string, timeZone: string = RESET_TIME_ZONE): number {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  // Midi UTC tombe dans ce même jour pour tout fuseau d'Europe.
  return nextMidnight(Date.UTC(year, month - 1, day, 12), timeZone);
}

const pad = (value: number) => String(value).padStart(2, '0');

/** « 04:31:54 » ; arrondi à la seconde supérieure : « 00:00:00 » veut dire que c'est l'heure. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}
