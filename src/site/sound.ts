/**
 * Réglage du son du site (code du 29/09/2026) : `localStorage['wiki-masters-sound']` = `'off'` pour couper,
 * autre chose ou absent : son actif. Le site ne le lit qu'une fois par chargement (valeur gardée en
 * mémoire) : le changer en cours de page n'a d'effet qu'au rechargement. Tous ses sons sont en Web Audio.
 */
const KEY = 'wiki-masters-sound';

/**
 * Sons du site, par fichier (`/audio/<nom>.mp3`) : ouverture d'un paquet ; changement de carte dans le
 * carrousel, dans les deux sens ; arrivée sur une L (et à l'ouverture si la première carte en est une).
 */
export const SITE_SOUNDS = { packRip: 'pack-rip', cardFlip: 'card-flip', legendary: 'legendary-reveal' } as const;

/** Son coupé par le réglage du site ? */
export function isSiteSoundOff(): boolean {
  try {
    return localStorage.getItem(KEY) === 'off';
  } catch {
    return false;
  }
}

/** Remet le son du site en marche (pris en compte au prochain chargement de page par le site). */
export function enableSiteSound(): void {
  try {
    if (localStorage.getItem(KEY) !== 'on') localStorage.setItem(KEY, 'on');
  } catch {
    // Stockage indisponible : le site garde son réglage.
  }
}
