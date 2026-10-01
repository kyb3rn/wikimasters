import { normalizeText } from '@/core/text';

/**
 * Renomme un bouton du site : son nœud texte (enfant direct) qui se lit `from` devient `to`, blancs autour gardés,
 * sans toucher à son icône. React ne le réécrit que si son propre texte change. Idempotent.
 */
export function renameText(element: Element, from: string, to: string): void {
  if (from === to) return;
  for (const node of element.childNodes) {
    if (node.nodeType !== Node.TEXT_NODE || normalizeText(node.textContent) !== from) continue;
    const text = node.textContent ?? '';
    const start = text.length - text.trimStart().length;
    const end = text.trimEnd().length;
    node.textContent = `${text.slice(0, start)}${to}${text.slice(end)}`;
  }
}
