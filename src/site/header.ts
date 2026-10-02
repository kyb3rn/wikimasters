/**
 * En-tête du site : le bouton du solde (ouvre la boutique) existe en deux exemplaires,
 * barre du haut sur mobile (`md:hidden fixed top-0 …`) et boîte fixe en haut à droite sur
 * ordinateur (`hidden md:block fixed top-0 right-0 … pointer-events-none`, bouton en
 * `pointer-events-auto`). Relevé le 29/09/2026.
 */
const BALANCE_BUTTON = 'button[aria-label="Ouvrir la boutique WikiBidous"]';

export function findBalanceButtons(root: ParentNode = document): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>(BALANCE_BUTTON)];
}

export const isBalanceButton = (element: Element): boolean => element.matches(BALANCE_BUTTON);

/**
 * Cadre du solde, son parent direct : la boîte fixe elle-même sur ordinateur (`display` donné par `md:block`) ;
 * sur mobile, la rangée `flex h-11` de la barre, qui porte aussi la cloche du site. Nos boutons y sont posés.
 */
export const BALANCE_BOX = `div.fixed:has(> ${BALANCE_BUTTON})`;
export const BALANCE_ROW = `div.flex:has(> ${BALANCE_BUTTON})`;

/** Bas du cadre du solde affiché, en pixels depuis le haut de l'écran ; `undefined` s'il est caché. */
export function balanceBottom(doc: Document = document): number | undefined {
  let bottom: number | undefined;
  for (const button of findBalanceButtons(doc)) {
    const rect = (button.closest(`${BALANCE_BOX}, ${BALANCE_ROW}`) ?? button).getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) bottom = Math.max(bottom ?? 0, rect.bottom);
  }
  return bottom;
}

/**
 * Nos boutons devant le solde (engrenage, cloche), rangés par rang croissant : chacun porte son rang, et se pose
 * après ceux de rang plus petit, quel que soit l'ordre dans lequel ils arrivent.
 */
const HEADER_RANK = 'data-wm-header-rank';

/** Élément avant lequel poser notre bouton de rang `rank` (le solde, ou l'un des nôtres de rang plus grand). */
export function headerSlot(balance: Element, rank: number): Element {
  let before = balance;
  for (let item = balance.previousElementSibling; item?.hasAttribute(HEADER_RANK); item = item.previousElementSibling) {
    if (Number(item.getAttribute(HEADER_RANK)) <= rank) break;
    before = item;
  }
  return before;
}

/** Note le rang de notre bouton (n'écrit que s'il change). */
export function markHeaderItem(element: Element, rank: number): void {
  if (element.getAttribute(HEADER_RANK) !== String(rank)) element.setAttribute(HEADER_RANK, String(rank));
}

/** Rangs de nos boutons devant le solde. */
export const HEADER_RANKS = { gear: 0, notifications: 1 } as const;
