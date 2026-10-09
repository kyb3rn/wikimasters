import { setReactInputValue } from '@/core/react';
import type { Feature } from '@/core/runtime';
import { AUCTION_BID_INPUT } from '@/site/marketplace';
import { AUCTION_ROUTE } from '@/site/routes';
import { keepsTyped, readTyped, type TypedAmount } from './typed';

const isBidInput = (node: Element): node is HTMLInputElement => node instanceof HTMLInputElement && node.matches(AUCTION_BID_INPUT);

/**
 * Page d'une enchère : le site remet le champ de la mise à sa mise minimum à chaque mise reçue en direct, à chaque
 * relecture de l'enchère (temps réel rejoint, fin du compte à rebours) et après une mise placée (code du site,
 * 01/10/2026), même quand le montant saisi reste valable. Ce montant est remis aussitôt, tant qu'il ne passe pas sous
 * la mise minimum.
 */
export const auctionTypedBid: Feature = {
  id: 'auction-typed-bid',
  name: 'Montant de la mise',
  toggleLabel: 'Garder le montant saisi',
  description: "Le montant saisi n'est plus remplacé par la mise minimum, sauf s'il passe en dessous.",
  category: 'Marché',
  routes: [AUCTION_ROUTE],
  async mount(ctx) {
    const { signal, log } = ctx;
    if (!(await ctx.ready())) return;
    /** Montant choisi par l'utilisateur (frappe, flèches, molette, boutons du champ), tant que le site ne l'a pas remplacé. */
    let typed: (TypedAmount & { readonly input: HTMLInputElement }) | undefined;
    /** Champ dont un bouton « Diminuer » / « Augmenter » vient d'être cliqué : sa valeur change au rendu qui suit. */
    let stepped: HTMLInputElement | undefined;
    let frame = 0;

    function remember(input: HTMLInputElement): void {
      const amount = readTyped(input.value);
      typed = amount && { ...amount, input };
    }

    // Rien dans le DOM ne signale la réécriture : tant que le champ a le focus, React change sa valeur sans son
    // attribut. Vérifié à chaque image tant qu'un montant est saisi, avant l'affichage : aucun clignotement.
    function check(): void {
      frame = 0;
      if (stepped) {
        remember(stepped);
        stepped = undefined;
      }
      if (!typed) return;
      const { input, text } = typed;
      if (input.value !== text && input.isConnected && keepsTyped(typed, input.value, input.min)) {
        log.debug('montant saisi gardé', text, 'au lieu de', input.value);
        setReactInputValue(input, text);
      }
      // Mise minimum au-dessus du montant saisi, ou formulaire retiré (enchère finie) : la valeur du site reste.
      if (input.value !== text || !input.isConnected) typed = undefined;
      else watch();
    }

    function watch(): void {
      if (!frame) frame = requestAnimationFrame(check);
    }
    signal.addEventListener('abort', () => cancelAnimationFrame(frame), { once: true });

    // Gestes de l'utilisateur seulement : notre remise du montant passe aussi par un événement `input`.
    document.addEventListener(
      'input',
      (event) => {
        if (!event.isTrusted || !(event.target instanceof Element) || !isBidInput(event.target)) return;
        remember(event.target);
        watch();
      },
      { capture: true, signal },
    );
    document.addEventListener(
      'click',
      (event) => {
        if (!event.isTrusted || !(event.target instanceof Element)) return;
        const field = event.target.closest('button')?.parentElement;
        const input = field && [...field.children].find(isBidInput);
        if (!input) return;
        stepped = input;
        watch();
      },
      { capture: true, signal },
    );
  },
};
