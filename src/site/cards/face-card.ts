import { isRecord } from '@/core/guards';
import { currentFiberAncestors } from '@/core/react';
import { parseCardRef, type CardRef } from './ref';

/**
 * Carte d'une face des grilles du site : le composant de la face reçoit la carte (`{ card, size, onClick, … }`,
 * code du site, 01/10/2026), juste au-dessus de son élément. Rareté : celle de la carte.
 */
export function readFaceCard(face: Element): CardRef | undefined {
  for (const fiber of currentFiberAncestors(face).slice(0, 4)) {
    const props: unknown = fiber.memoizedProps;
    const card = isRecord(props) ? parseCardRef(props.card) : undefined;
    if (card) return card;
  }
  return undefined;
}
