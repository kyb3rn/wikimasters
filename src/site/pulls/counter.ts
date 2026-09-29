/**
 * Cadre des paquets disponibles, sous « Ouvrir » (choix du paquet sur `/pulls`, relevé le 29/09/2026) :
 *
 *   div.card-frame.px-6.py-3.flex.flex-col.items-center.gap-1.text-center
 *     div.text-lg.font-bold > span (accent) n · span « / 10 » (le maximum est écrit tel quel par le site)
 *     div.text-xs « paquets disponibles »
 *     div.text-xs « Prochain dans » span.font-mono « m:ss »   (absent quand il n'en manque aucun)
 *
 * Le temps restant est réécrit chaque seconde par le site (texte seul, sans autre changement du DOM).
 */
export interface PackCounter {
  readonly root: HTMLElement;
  readonly available: number;
  readonly max: number;
  /** Temps avant le prochain paquet (« 2:14 ») ; `undefined` : plein. */
  readonly next: string | undefined;
}

const text = (element: Element | null | undefined) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

export function findPackCounter(doc: Document = document): PackCounter | undefined {
  const main = doc.querySelector('main');
  if (!main) return undefined;
  for (const label of main.querySelectorAll('div.card-frame > div')) {
    if (text(label) !== 'paquets disponibles') continue;
    const root = label.parentElement;
    const count = root?.firstElementChild;
    if (!(root instanceof HTMLElement) || !count) continue;
    const [available, max] = [...count.querySelectorAll('span')].map((span) => Number(text(span).replace(/[^\d]/g, '')));
    if (available === undefined || max === undefined || !Number.isFinite(available) || !max) continue;
    const next = [...root.children].find((line) => text(line).startsWith('Prochain dans'));
    return { root, available, max, next: next ? text(next.querySelector('span')) || undefined : undefined };
  }
  return undefined;
}
