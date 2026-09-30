import { SITE_OVERLAY } from '@/site/modals';
import { siteButtons, text } from './dom';

/**
 * Modale « Mettre aux enchères » du site, ouverte par-dessus la modale de carte (code du site relevé
 * le 29/09/2026) :
 *
 *   div.fixed.inset-0.z-[60] (fond, un clic ferme)
 *     div.card-frame
 *       button[aria-label=Fermer]
 *       h2 « Mettre aux enchères », « Un exemplaire sera mis en réserve… »,
 *         « Enchères actives : n/max » (seulement une fois `GET /api/marketplace/mine` revenu)
 *       petite face `[class*="glow-"]` (w-28 h-40) et résumé du marché
 *       « Mise de départ » : Diminuer · input[aria-label="Mise de départ"] (« 10 » au départ) · Augmenter
 *       « Durée » : 10 min · 30 min · 1 h (défaut) · 3 h · 6 h · 12 h, l'actif porte bg-[var(--color-accent)]
 *       p.text-red-500 : erreur (message de la réponse, « Erreur réseau »…), absente sinon
 *       « Annuler » · « Lancer l'enchère » (« Mise en vente… » pendant l'envoi ; désactivé pendant l'envoi,
 *         mise invalide ou limite d'enchères atteinte)
 *
 * Tout l'état (mise, durée, envoi, erreur) vit dans React : on le relit à chaque fois.
 */
export interface AuctionDuration {
  readonly label: string;
  readonly minutes: number;
  readonly button: HTMLButtonElement;
  readonly active: boolean;
}

export interface AuctionModal {
  readonly root: HTMLElement;
  /** Petite face de la carte mise en vente. */
  readonly face: HTMLElement | undefined;
  readonly priceInput: HTMLInputElement;
  readonly durations: readonly AuctionDuration[];
  readonly cancelButton: HTMLButtonElement;
  readonly launchButton: HTMLButtonElement;
  readonly sending: boolean;
  readonly quota: { readonly active: number; readonly max: number } | undefined;
  readonly error: string | undefined;
}

/** « 10 min » → 10, « 1 h » → 60, « 2 j » → 2880 ; autre texte → `undefined`. */
export function parseDuration(label: string): number | undefined {
  const match = /^(\d+)\s*(min|h|j)$/i.exec(label.trim());
  if (!match?.[1] || !match[2]) return undefined;
  const unit = { min: 1, h: 60, j: 1440 }[match[2].toLowerCase() as 'min' | 'h' | 'j'];
  return Number(match[1]) * unit;
}

export function findAuctionModal(doc: Document = document): AuctionModal | undefined {
  for (const root of doc.querySelectorAll<HTMLElement>(SITE_OVERLAY)) {
    const heading = [...root.querySelectorAll('h2')].some((h2) => text(h2) === 'Mettre aux enchères');
    const priceInput = root.querySelector<HTMLInputElement>('input[aria-label="Mise de départ"]');
    if (!heading || !priceInput) continue;
    const buttons = siteButtons(root);
    const cancelButton = buttons.find((button) => text(button) === 'Annuler');
    const launchButton = buttons.find((button) => /^(Lancer l.enchère|Mise en vente)/.test(text(button)));
    if (!cancelButton || !launchButton) continue;

    const durations = buttons.flatMap((button) => {
      const minutes = parseDuration(text(button));
      if (minutes === undefined) return [];
      return [{ label: text(button), minutes, button, active: button.classList.contains('bg-[var(--color-accent)]') }];
    });
    const quota = /Enchères actives\s*:\s*(\d+)\s*\/\s*(\d+)/.exec(root.textContent ?? '');
    return {
      root,
      face: [...root.querySelectorAll<HTMLElement>('[class*="glow-"]')].find((el) => el.querySelector('h3')),
      priceInput,
      durations,
      cancelButton,
      launchButton,
      sending: text(launchButton).startsWith('Mise en vente'),
      quota: quota ? { active: Number(quota[1]), max: Number(quota[2]) } : undefined,
      error: text(root.querySelector('p.text-red-500')) || undefined,
    };
  }
  return undefined;
}
