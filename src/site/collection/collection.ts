import { ROOT_CLASS } from '@/core/dom';
import { isRecord } from '@/core/guards';
import type { NetRequest } from '@/core/net';

/**
 * Page de la collection (captures du 29/09/2026) : liste de 50 exemplaires par page
 * (`GET /api/my-collection?sort=&page=&stats=0[&filtres]`) et ses compteurs (`GET /api/my-collection/stats?…`).
 * Grille `div.flex.flex-wrap.justify-center` > `div.relative.isolate.group` > face, dans l'ordre de la liste.
 * Après une défausse ou une mise aux enchères réussie depuis sa modale, le site recharge tout : liste,
 * compteurs, échanges en cours, étiquettes, solde (la liste peut alors échouer : 500, grille vide).
 */
export const COLLECTION_ROUTE = '/collection';

/** Exemplaire de la liste (`collection[]`) : `id` est celui que défausse ou met en vente sa modale. */
export interface CollectionEntry {
  readonly id: string;
  readonly title: string;
  /** Exemplaires possédés de cette carte. */
  readonly count: number;
}

export function isCollectionList(request: NetRequest): boolean {
  return request.method === 'GET' && request.url.pathname === '/api/my-collection';
}

export function isCollectionStats(request: NetRequest): boolean {
  return request.method === 'GET' && request.url.pathname === '/api/my-collection/stats';
}

export function parseCollection(raw: unknown): CollectionEntry[] | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.collection)) return undefined;
  const entries: CollectionEntry[] = [];
  for (const row of raw.collection) {
    if (!isRecord(row) || typeof row.id !== 'string') return undefined;
    const card = isRecord(row.card) ? row.card : {};
    entries.push({
      id: row.id,
      title: typeof card.wikipedia_title === 'string' ? card.wikipedia_title : '',
      count: typeof row.count === 'number' ? row.count : 1,
    });
  }
  return entries;
}

/** Faces de la grille, dans l'ordre de la liste : hors modales du site et hors nos interfaces. */
export function findCollectionFaces(doc: Document = document): HTMLElement[] {
  const main = doc.querySelector('main');
  if (!main) return [];
  return [...main.querySelectorAll<HTMLElement>('[class*="glow-"]')].filter(
    (face) => face.querySelector('h3') && !face.closest('div.fixed.inset-0') && !face.closest(`.${ROOT_CLASS}`),
  );
}
