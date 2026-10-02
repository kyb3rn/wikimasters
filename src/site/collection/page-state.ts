import { isRecord, parseJson } from '@/core/guards';
import type { NetRequest } from '@/core/net';
import { currentFiberAncestors, type Fiber, type StateHook } from '@/core/react';
import { statesAboveRefresh } from '@/site/list-page';
import { isCollectionList, isCollectionStats } from './collection';
import { findCollectionFilters } from './filters';

/** Étiquette telle que la page la garde (sur un exemplaire, dans son catalogue, dans ses compteurs). */
export interface PageTag {
  readonly id: string;
  readonly name: string;
  readonly color?: string;
}

/** Étiquettes posées sur des exemplaires, ou retirées. */
export interface TagChange {
  readonly cardIds: readonly string[];
  /** Posées ; une déjà présente sur un exemplaire n'y est pas doublée. */
  readonly add?: readonly PageTag[];
  /** Ids des étiquettes retirées. */
  readonly remove?: readonly string[];
}

type Row = Record<string, unknown>;

const tagsOf = (entry: Row): Row[] => (Array.isArray(entry.tags) ? entry.tags.filter(isRecord) : []);
const idOf = (row: unknown) => (isRecord(row) && typeof row.id === 'string' ? row.id : undefined);

/** Exemplaires (`collection[]`) avec leurs étiquettes changées ; les autres restent les mêmes objets. */
export function retagEntries(entries: readonly unknown[], change: TagChange, known: ReadonlyMap<string, Row>): unknown[] {
  const cards = new Set(change.cardIds);
  const removed = new Set(change.remove ?? []);
  return entries.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !cards.has(entry.id)) return entry;
    const tags = tagsOf(entry).filter((tag) => !removed.has(idOf(tag) ?? ''));
    for (const tag of change.add ?? []) {
      if (tags.some((other) => idOf(other) === tag.id)) continue;
      // Couleur absente : celle que la page connaît déjà.
      tags.push({ ...known.get(tag.id), id: tag.id, name: tag.name, ...(tag.color !== undefined && { color: tag.color }) });
    }
    return { ...entry, tags };
  });
}

/**
 * Compteurs des étiquettes (`tagOptions` : étiquette + `cardCount`) après le changement : chaque exemplaire
 * qui gagne ou perd une étiquette la compte ou la décompte ; une étiquette nouvelle y entre.
 */
export function recountTagOptions(options: readonly unknown[], entries: readonly unknown[], change: TagChange): unknown[] {
  const cards = new Set(change.cardIds);
  const chosen = entries.filter((entry): entry is Row => isRecord(entry) && typeof entry.id === 'string' && cards.has(entry.id));
  const has = (entry: Row, id: string) => tagsOf(entry).some((tag) => idOf(tag) === id);
  const delta = new Map<string, number>();
  for (const tag of change.add ?? []) delta.set(tag.id, chosen.filter((entry) => !has(entry, tag.id)).length);
  for (const id of change.remove ?? []) delta.set(id, -chosen.filter((entry) => has(entry, id)).length);
  const next = options.map((option) => {
    const id = idOf(option);
    const shift = id === undefined ? 0 : (delta.get(id) ?? 0);
    if (!isRecord(option) || shift === 0) return option;
    const count = typeof option.cardCount === 'number' ? option.cardCount : 0;
    return { ...option, cardCount: Math.max(0, count + shift) };
  });
  for (const tag of change.add ?? []) {
    const count = delta.get(tag.id) ?? 0;
    if (count > 0 && !options.some((option) => idOf(option) === tag.id)) next.push({ ...tag, cardCount: count });
  }
  return next;
}

interface PageStates {
  readonly list: StateHook;
  readonly tagOptions: StateHook;
  readonly catalog: StateHook;
}

/**
 * Premiers états de la page Collection (code du site, 29/09/2026), dans l'ordre : exemplaires affichés,
 * total, compteurs des étiquettes (`tagOptions`), étiquettes de l'utilisateur (lues à Supabase, `null` avant).
 * La grille (étiquettes sur les faces), la liste des étiquettes et la modale de carte s'en dessinent
 * (`statesAboveRefresh`).
 */
export function pageStatesAmong(ancestors: readonly Fiber[]): PageStates | undefined {
  const [list, total, tagOptions, catalog] = statesAboveRefresh(ancestors) ?? [];
  if (!list || !total || !tagOptions || !catalog) return undefined;
  const entries = Array.isArray(list.value) && list.value.every((entry) => isRecord(entry) && 'card' in entry);
  const valid = entries && typeof total.value === 'number' && Array.isArray(tagOptions.value) && (catalog.value === null || Array.isArray(catalog.value));
  return valid ? { list, tagOptions, catalog } : undefined;
}

function pageStates(doc: Document): PageStates | undefined {
  const row = findCollectionFilters(doc)?.row;
  return row && pageStatesAmong(currentFiberAncestors(row));
}

/** Étiquettes que la page affiche : sur ses exemplaires, dans ses compteurs. */
export interface ShownTags {
  readonly entries: readonly unknown[];
  readonly tagOptions: readonly unknown[];
}

/**
 * Réponse de la liste (`collection[]`) ou de ses compteurs (`tagOptions`) avec les étiquettes que la page affiche.
 * Les autres champs restent ceux de la réponse.
 */
export function withShownTags(kind: 'list' | 'stats', body: unknown, shown: ShownTags): unknown {
  if (!isRecord(body)) return body;
  if (kind === 'stats') return Array.isArray(body.tagOptions) ? { ...body, tagOptions: shown.tagOptions } : body;
  if (!Array.isArray(body.collection)) return body;
  const tags = new Map<string, unknown[]>();
  for (const entry of shown.entries) {
    const id = idOf(entry);
    if (id !== undefined && isRecord(entry) && Array.isArray(entry.tags)) tags.set(id, entry.tags);
  }
  const collection = (body.collection as unknown[]).map((row) => {
    const current = tags.get(idOf(row) ?? '');
    return current && isRecord(row) ? { ...row, tags: current } : row;
  });
  return { ...body, collection };
}

/**
 * Réponse gardée de la liste ou de ses compteurs, à resservir : une étiquette posée ou retirée sur place depuis
 * son chargement (modale de carte, étiquetage groupé) n'y est pas, et la page la perdrait. On y met donc celles
 * que la page affiche. Rien si l'état de la page n'est pas reconnu ou la réponse illisible.
 */
export function shownCollectionReply(request: NetRequest, body: string, doc: Document = document): string | undefined {
  const kind = isCollectionList(request) ? 'list' : isCollectionStats(request) ? 'stats' : undefined;
  const states = kind && pageStates(doc);
  const parsed = parseJson(body);
  if (!kind || !states || parsed === undefined) return undefined;
  const shown = { entries: states.list.value as unknown[], tagOptions: states.tagOptions.value as unknown[] };
  return JSON.stringify(withShownTags(kind, parsed, shown));
}

/**
 * Pose ou retire des étiquettes sur les exemplaires affichés, sans rien recharger, comme le fait la modale
 * de carte du site (exemplaire mis à jour dans la liste, étiquette nouvelle ajoutée au catalogue), compteurs
 * compris. Faux si l'état de la page n'est pas reconnu (rien n'est alors changé).
 */
export function applyTagChange(change: TagChange, doc: Document = document): boolean {
  const states = pageStates(doc);
  if (!states) return false;
  const entries = states.list.value as unknown[];
  const options = states.tagOptions.value as unknown[];
  const catalog = states.catalog.value as unknown[] | null;
  const known = new Map<string, Row>();
  for (const tag of [...(catalog ?? []), ...options]) {
    const id = idOf(tag);
    if (id && isRecord(tag)) known.set(id, { id, name: tag.name, color: tag.color });
  }
  // Couleur d'une étiquette existante : celle que la page connaît.
  const add = (change.add ?? []).map((tag) => {
    const color = tag.color ?? known.get(tag.id)?.color;
    return typeof color === 'string' ? { ...tag, color } : tag;
  });
  const resolved = { ...change, add };
  states.list.set(retagEntries(entries, resolved, known));
  states.tagOptions.set(recountTagOptions(options, entries, resolved));
  const fresh = add.filter((tag) => !(catalog ?? []).some((other) => idOf(other) === tag.id));
  if (catalog && fresh.length > 0) states.catalog.set([...catalog, ...fresh]);
  return true;
}
