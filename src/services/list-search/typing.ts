import type { ListQuery, ListSource } from './types';

/** Pages dont la recherche retient aussi la frappe : rien ne part tant qu'on ne la lance pas. */
const heldTyping = new Set<ListSource<ListQuery>>();

export function holdTyping(source: ListSource<ListQuery>, signal: AbortSignal): void {
  if (signal.aborted) return;
  heldTyping.add(source);
  signal.addEventListener('abort', () => heldTyping.delete(source), { once: true });
}

export function isTypingHeld(source: ListSource<ListQuery>): boolean {
  return heldTyping.has(source);
}
