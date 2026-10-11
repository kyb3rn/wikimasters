import type { CardModal } from '@/site/cards';
import { lockControl } from '@/ui/lock';
import { stampFace, STAMPS } from '@/ui/stamp';

/** Exemplaire qui n'existe plus pour le site : défaussé, ou réservé par une enchère. */
export type CardMark = 'discarded' | 'listed';

/** Raison d'un contrôle verrouillé sur un exemplaire marqué (info-bulle), la même partout. */
export const CARD_MARK_REASONS: Readonly<Record<CardMark, string>> = {
  discarded: 'Carte déjà défaussée',
  listed: 'Carte déjà en vente',
};

/**
 * Exemplaire en favori : le site le verrouille, ni défausse, ni vente, ni échange (depuis le 10/10/2026). `label` :
 * texte de nos boutons (celui du site sur une face verrouillée) ; `reason` : info-bulle (son encart de la modale).
 */
export const FAVORITE_LOCK = {
  label: 'Verrouillée (favori)',
  reason: "Carte en favori : verrouillée. Retirez-la des favoris pour la vendre, la défausser ou l'échanger.",
} as const;

/**
 * Modale de carte d'un exemplaire défaussé ou mis en vente (`mark`), ou plus (`undefined`) : « Mettre aux enchères »,
 * « Défausser » et le champ des étiquettes verrouillés au nom de `owner`, carte tamponnée (un clic la montre sans le
 * tampon). Idempotent.
 */
export function markModalCard(modal: CardModal, owner: string, mark: CardMark | undefined): void {
  for (const control of [modal.auctionButton, modal.discardButton, modal.tagInput]) {
    if (control) lockControl(control, { owner, locked: mark !== undefined, reason: mark && CARD_MARK_REASONS[mark] });
  }
  if (modal.face) stampFace(modal.face, owner, mark && { ...STAMPS[mark], revealable: true });
}
