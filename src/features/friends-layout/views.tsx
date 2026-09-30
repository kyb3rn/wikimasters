import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';

export interface SearchActionsProps {
  /** Lien copié : le site affiche « Copié ! » et une coche pendant 2 s. */
  readonly copied: boolean;
  readonly onInvite: () => void;
  readonly onAdd: () => void;
}

/** À droite du champ de recherche : les deux boutons de l'en-tête du site (cachés), qu'ils déclenchent ; vert, comme chez lui. */
export function SearchActions({ copied, onInvite, onAdd }: SearchActionsProps) {
  return (
    <>
      <button type="button" class={`${buttonClass('standard', { tone: 'accent' })} wm-friends-action`} onClick={onInvite}>
        <Icon name={copied ? 'check' : 'link'} size={16} />
        {copied ? 'Copié !' : 'Inviter'}
      </button>
      <button type="button" class={`${buttonClass('standard', { tone: 'accent', fill: 'solid' })} wm-friends-action`} onClick={onAdd}>
        <span>+</span> Ajouter un ami
      </button>
    </>
  );
}

export interface SiteAction {
  /** Info-bulle du bouton du site (« Envoyer un message »…). */
  readonly title: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
}

export interface FriendActionsProps {
  readonly message: SiteAction | undefined;
  readonly trade: SiteAction | undefined;
  readonly onRemove: () => void;
}

/** Actions d'un ami : Message en bleu, Échanger en vert (icône seule sur mobile), retirer en rouge (icône seule), en contour. */
export function FriendActions({ message, trade, onRemove }: FriendActionsProps) {
  return (
    <>
      {message && (
        <button
          type="button"
          class={buttonClass('standard', { tone: 'info' })}
          title={message.title}
          aria-label="Message"
          disabled={message.disabled}
          onClick={message.onClick}
        >
          <Icon name="message" size={16} />
          <span class={siteClass.wideOnly}>Message</span>
        </button>
      )}
      {trade && (
        <button type="button" class={buttonClass('standard', { tone: 'accent' })} title={trade.title} aria-label="Échanger" disabled={trade.disabled} onClick={trade.onClick}>
          <Icon name="handshake" size={16} />
          <span class={siteClass.wideOnly}>Échanger</span>
        </button>
      )}
      <button type="button" class={buttonClass('standard', { tone: 'danger' })} title="Retirer des amis" aria-label="Retirer des amis" onClick={onRemove}>
        <Icon name="user-minus" size={16} />
      </button>
    </>
  );
}

/** « Annuler » d'une demande envoyée, bouton standard rouge en contour ; roue pendant l'annulation. */
export function CancelButton({ busy, onClick }: { readonly busy: boolean; readonly onClick: () => void }) {
  return (
    <button type="button" class={buttonClass('standard', { tone: 'danger' })} disabled={busy} aria-busy={busy} onClick={onClick}>
      <Icon name={busy ? 'spinner' : 'close'} size={16} class={busy ? 'wm-spin' : undefined} />
      Annuler
    </button>
  );
}
