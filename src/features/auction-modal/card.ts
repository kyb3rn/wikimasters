import { ROOT_CLASS } from '@/core/dom';
import { findCardModals, type AuctionModal } from '@/site/cards';

const title = (face: Element) => (face.querySelector('h3')?.textContent ?? '').replace(/\s+/g, ' ').trim();

const DROPPED_CLASS = /^(hover:|cursor-|transition|duration-|animate-|wm-)/;

/** Copie inerte d'une face du site : sans ses boutons (favori), nos ajouts ni ses effets de survol. */
function cloneFace(face: HTMLElement): HTMLElement {
  const clone = face.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(`button, .${ROOT_CLASS}, .wm-stamp`).forEach((node) => node.remove());
  for (const element of [clone, ...clone.querySelectorAll('*')]) {
    const classes = [...element.classList];
    const kept = classes.filter((name) => !DROPPED_CLASS.test(name));
    if (kept.length !== classes.length) element.setAttribute('class', kept.join(' '));
    for (const { name } of [...element.attributes]) if (name.startsWith('data-wm-')) element.removeAttribute(name);
  }
  return clone;
}

/** La petite face de la modale d'enchère (112 × 160) refaite au format de la modale de carte (288 × 420). */
function enlarge(face: HTMLElement): HTMLElement {
  const clone = cloneFace(face);
  const swap = (element: Element, pairs: Readonly<Record<string, string>>) => {
    for (const [from, to] of Object.entries(pairs)) if (element.classList.contains(from)) element.classList.replace(from, to);
  };
  swap(clone, { 'w-28': 'w-72', 'h-40': 'h-[420px]' });
  clone.style.width = '288px';
  clone.style.height = '420px';
  clone.querySelectorAll('h3').forEach((h3) => swap(h3, { 'text-[10px]': 'text-base' }));
  clone.querySelectorAll('p').forEach((p) => swap(p, { 'text-[9px]': 'text-[10px]', 'line-clamp-3': 'line-clamp-[10]' }));
  clone.querySelectorAll('[class*="text-[8px]"]').forEach((el) => swap(el, { 'text-[8px]': 'text-sm' }));
  clone.querySelectorAll('img[sizes]').forEach((img) => img.setAttribute('sizes', '288px'));
  return clone;
}

/**
 * La carte à montrer : celle de la modale de carte restée ouverte en dessous (grand format : résumé,
 * ATK / DEF), sinon la petite face de la modale d'enchère agrandie.
 */
export function saleCard(modal: AuctionModal): { card: HTMLElement | undefined; title: string } {
  const small = modal.face;
  const wanted = small ? title(small) : '';
  const cardModals = findCardModals().filter((cardModal) => cardModal.face);
  const below = cardModals.find((cardModal) => cardModal.face && title(cardModal.face) === wanted) ?? cardModals[0];
  if (below?.face) return { card: cloneFace(below.face), title: wanted || below.title };
  return { card: small ? enlarge(small) : undefined, title: wanted };
}
