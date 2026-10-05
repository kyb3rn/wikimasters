import { isOwn } from '@/site/dom';

/**
 * Page `/dms` (captures du 29/09/2026 et du 04/10/2026), rendue par le serveur avec le titre et une roue à la place
 * de la liste, le temps de `GET /api/chat` :
 *
 *   main > div.flex-1.p-4.md:p-6.space-y-6
 *     div (h1 « Messages », sous-titre)
 *     div.flex.justify-center.py-16 > div.animate-spin (chargement)
 *     div.space-y-1 (une ligne par conversation de `GET /api/chat`)
 *       button.w-full.text-left
 *         div.relative (photo ou initiales)
 *         div.flex-1.min-w-0 > div > p.font-medium (pseudo) + span (heure) ; p (dernier message)
 *
 * Une ligne ouvre la conversation en modale (`chat.ts`).
 */
export interface DmsPage {
  readonly root: HTMLElement;
  /** Bloc du titre. */
  readonly header: HTMLElement;
  /** Bloc des lignes, absent tant qu'aucune n'est affichée. */
  readonly list: HTMLElement | undefined;
  readonly rows: readonly DmsRow[];
  /** Liste en cours de chargement (roue du site). */
  readonly loading: boolean;
}

export interface DmsRow {
  readonly button: HTMLButtonElement;
  readonly username: string;
}

const ROW = 'button.text-left';
const ROW_NAME = ':scope > div.flex-1.min-w-0 > div:first-child > p:first-child';

function readDmsRow(button: HTMLButtonElement): DmsRow | undefined {
  // Pseudo exact (pas d'espaces réduits) : il sert à l'adresse du profil.
  const username = (button.querySelector(ROW_NAME)?.textContent ?? '').trim();
  return username === '' ? undefined : { button, username };
}

export function findDmsPage(doc: Document = document): DmsPage | undefined {
  for (const root of doc.querySelectorAll<HTMLElement>('main > div')) {
    const header = root.querySelector<HTMLElement>(':scope > div:has(> h1)');
    if (!header) continue;
    const rows: DmsRow[] = [];
    let list: HTMLElement | undefined;
    for (const button of root.querySelectorAll<HTMLButtonElement>(`:scope > div > ${ROW}`)) {
      // La ligne du chat de guilde, posée sous le titre quand il n'y a pas de liste, a le même balisage.
      if (isOwn(button)) continue;
      const row = readDmsRow(button);
      if (!row) continue;
      rows.push(row);
      list ??= button.parentElement ?? undefined;
    }
    return { root, header, list, rows, loading: root.querySelector(':scope > div > div.animate-spin') !== null };
  }
  return undefined;
}

/** Ligne de conversation sous `target` (clic), s'il y en a une. */
export function dmsRowAt(target: EventTarget | null, page: DmsPage): DmsRow | undefined {
  if (!(target instanceof Element)) return undefined;
  const button = target.closest<HTMLButtonElement>(ROW);
  return button ? page.rows.find((row) => row.button === button) : undefined;
}
