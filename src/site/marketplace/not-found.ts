import { normalizeText } from '@/core/text';
import { soleMainChild } from '@/site/page-spinner';

/**
 * Enchère inexistante (`GET /api/marketplace/<id>` en 404, capture du 30/09/2026) : unique enfant de `<main>`,
 * `div.flex-1.p-6.text-center` dont le seul contenu est le texte « Enchère introuvable. », sans icône ni lien.
 * Reconnue à son premier nœud texte : on lui ajoute des enfants.
 */
export function findAuctionNotFound(main: Element): HTMLElement | undefined {
  const page = soleMainChild(main);
  if (!page?.classList.contains('text-center')) return undefined;
  const first = page.firstChild;
  return first?.nodeType === Node.TEXT_NODE && normalizeText(first.textContent).startsWith('Enchère introuvable') ? page : undefined;
}
