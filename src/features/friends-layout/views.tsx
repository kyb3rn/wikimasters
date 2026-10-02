import { buttonClass } from '@/ui/button';
import { cx } from '@/ui/cx';
import { Icon, type IconName } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { ACTION } from './style';

export interface InviteButtonProps {
  /** Lien copié : le site affiche « Copié ! » et une coche pendant 2 s. */
  readonly copied: boolean;
  readonly onClick: () => void;
  readonly class?: string;
}

/** « Inviter » de l'en-tête du site (caché), qu'il déclenche ; vert en contour, comme chez lui. */
export function InviteButton({ copied, onClick, class: extra }: InviteButtonProps) {
  return (
    <button type="button" class={cx(buttonClass('standard', { tone: 'accent' }), extra)} onClick={onClick}>
      <Icon name={copied ? 'check' : 'link'} size={16} />
      {copied ? 'Copié !' : 'Inviter'}
    </button>
  );
}

export interface SearchActionsProps {
  readonly copied: boolean;
  readonly onInvite: () => void;
  readonly onAdd: () => void;
}

/** À droite du champ de recherche : les deux boutons de l'en-tête du site (cachés), qu'ils déclenchent ; vert, comme chez lui. */
export function SearchActions({ copied, onInvite, onAdd }: SearchActionsProps) {
  return (
    <>
      <InviteButton copied={copied} onClick={onInvite} class={ACTION} />
      <button type="button" class={cx(buttonClass('standard', { tone: 'accent', fill: 'solid' }), ACTION)} onClick={onAdd}>
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

interface BusyButtonProps {
  readonly busy: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}

/** Bouton standard en contour d'une demande en attente : roue à la place de son icône pendant sa requête. */
function RequestButton({ tone, icon, size = 'md', label, busy, disabled = false, onClick }: BusyButtonProps & {
  readonly tone: 'accent' | 'danger';
  readonly icon: IconName;
  readonly size?: 'md' | 'sm';
  readonly label: string;
}) {
  return (
    <button type="button" class={buttonClass('standard', { tone, size })} disabled={busy || disabled} aria-busy={busy} onClick={onClick}>
      <Icon name={icon} busy={busy} size={size === 'sm' ? 14 : 16} />
      {label}
    </button>
  );
}

/** « Annuler » d'une demande envoyée, rouge ; roue pendant l'annulation. */
export function CancelButton(props: BusyButtonProps) {
  return <RequestButton tone="danger" icon="close" label="Annuler" {...props} />;
}

export interface AnswerActionsProps {
  /** Réponse en cours pour cette demande : sa roue ; l'autre bouton est désactivé. */
  readonly busy: 'accept' | 'decline' | undefined;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}

/** Demande reçue : Accepter en vert, Refuser en rouge, comme « Annuler » des demandes envoyées. */
export function AnswerActions({ busy, onAccept, onDecline }: AnswerActionsProps) {
  return (
    <>
      <RequestButton tone="accent" icon="check" label="Accepter" busy={busy === 'accept'} disabled={busy !== undefined} onClick={onAccept} />
      <RequestButton tone="danger" icon="close" label="Refuser" busy={busy === 'decline'} disabled={busy !== undefined} onClick={onDecline} />
    </>
  );
}

/** « Tout accepter », petit (dans la ligne du titre) ; roue tant que le bouton du site est désactivé. */
export function AcceptAllButton(props: BusyButtonProps) {
  return <RequestButton tone="accent" icon="check-check" size="sm" label="Tout accepter" {...props} />;
}
