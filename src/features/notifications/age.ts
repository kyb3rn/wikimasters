const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Âge d'une notification : « À l'instant », « Il y a 5 min », « Il y a 3 h », « Il y a 2 j », « Il y a 3 sem. »,
 * « Il y a 4 mois », « Il y a 2 ans ». Arrondi vers le bas (59 min restent « 59 min »). Une date dans le futur
 * (horloge du PC en retard sur celle du serveur) compte comme « À l'instant ».
 */
export function notificationAge(time: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - time);
  if (elapsed < MINUTE) return "À l'instant";
  if (elapsed < HOUR) return `Il y a ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `Il y a ${Math.floor(elapsed / HOUR)} h`;
  if (elapsed < 7 * DAY) return `Il y a ${Math.floor(elapsed / DAY)} j`;
  if (elapsed < 30 * DAY) return `Il y a ${Math.floor(elapsed / (7 * DAY))} sem.`;
  if (elapsed < 365 * DAY) return `Il y a ${Math.floor(elapsed / (30 * DAY))} mois`;
  const years = Math.floor(elapsed / (365 * DAY));
  return `Il y a ${years} an${years > 1 ? 's' : ''}`;
}

/** Âges remis à jour à cet intervalle tant que la liste est ouverte. */
export const AGE_REFRESH_MS = 30_000;
