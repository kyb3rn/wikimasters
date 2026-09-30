export const formatNumber = (value: number): string => value.toLocaleString('fr-FR');

/** Arrondi au dixième (moyennes). */
export const round1 = (value: number): number => Math.round(value * 10) / 10;

export const plural = (count: number, word: string): string => `${count} ${word}${count > 1 ? 's' : ''}`;

/** Âge d'un chargement : « à l'instant », « il y a 5 min », « il y a 3 h », « il y a 2 j ». */
export function ageText(time: number, now = Date.now()): string {
  const seconds = Math.max(0, (now - time) / 1000);
  if (seconds < 60) return "à l'instant";
  if (seconds < 3600) return `il y a ${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `il y a ${Math.round(seconds / 3600)} h`;
  return `il y a ${Math.round(seconds / 86_400)} j`;
}

export const formatDate = (time: number): string => new Date(time).toLocaleDateString('fr-FR');

export const formatTime = (time: number): string =>
  new Date(time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Jour et mois : « 29/09 ». */
export const shortDate = (time: number): string =>
  new Date(time).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
