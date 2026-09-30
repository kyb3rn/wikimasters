import type { SiteTag } from '@/site/api';
import { normalizeTagName } from '@/site/collection';

export type BulkMode = 'add' | 'remove';

/** Étiquette choisie, pas encore envoyée. */
export interface PendingTag {
  /** Absent pour une étiquette nouvelle, créée à l'envoi. */
  readonly id?: string;
  readonly name: string;
  /** Couleur d'une étiquette nouvelle. */
  readonly color?: string;
  /** Style en ligne de sa pastille. */
  readonly chipStyle: string;
}

const same = (a: PendingTag, b: PendingTag) =>
  a.id !== undefined || b.id !== undefined ? a.id === b.id : normalizeTagName(a.name) === normalizeTagName(b.name);

export function addPending(list: readonly PendingTag[], tag: PendingTag): readonly PendingTag[] {
  return list.some((other) => same(other, tag)) ? list : [...list, tag];
}

export function removePending(list: readonly PendingTag[], tag: PendingTag): readonly PendingTag[] {
  return list.filter((other) => !same(other, tag));
}

/** Nom tapé déjà choisi comme étiquette nouvelle. */
export function isPendingName(list: readonly PendingTag[], name: string): boolean {
  const wanted = normalizeTagName(name);
  return wanted !== '' && list.some((tag) => tag.id === undefined && normalizeTagName(tag.name) === wanted);
}

/** Étiquettes nouvelles, une fois créées : leur id. */
export function withCreatedIds(list: readonly PendingTag[], created: readonly SiteTag[]): readonly PendingTag[] {
  return list.map((tag) => {
    if (tag.id !== undefined) return tag;
    const row = created.find((candidate) => normalizeTagName(candidate.name) === normalizeTagName(tag.name));
    return row ? { ...tag, id: row.id } : tag;
  });
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;

export function submitLabel(mode: BulkMode, count: number): string {
  const verb = mode === 'add' ? 'Ajouter' : 'Retirer';
  return count === 0 ? `${verb} les étiquettes` : `${verb} ${plural(count, 'étiquette')}`;
}

export function doneMessage(mode: BulkMode, tags: number, cards: number): string {
  const done = mode === 'add' ? `ajoutée${tags > 1 ? 's' : ''} à` : `retirée${tags > 1 ? 's' : ''} de`;
  return `${plural(tags, 'étiquette')} ${done} ${plural(cards, 'carte')}.`;
}
