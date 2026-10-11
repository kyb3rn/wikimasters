import { isPlainClick } from '@/core/dom';
import { navigateTo } from '@/site/router';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';

/**
 * « Voir l'enchère », à la place de « Vendre » dans la modale d'un exemplaire aux enchères (demande de l'utilisateur) :
 * même allure, navigation du site ; Ctrl, Maj, clic du milieu laissés au navigateur.
 */
export function AuctionLink({ href }: { readonly href: string }) {
  return (
    <a
      href={href}
      class={`${buttonClass('window', { tone: 'accent' })} wm-auction-link`}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        navigateTo(href);
      }}
    >
      <Icon name="gavel" size={16} />
      Voir l'enchère
    </a>
  );
}
