import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { isPlainClick } from '@/core/dom';
import { formatNotificationDate } from '@/site/notifications';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { AGE_REFRESH_MS, notificationAge } from './age';
import type { Entry } from './entries';
import { useCenter, type CenterStore } from './store';
import { wishedIn } from './wishlist';

export const BELL_CLASS = 'wm-notifications-bell';
export const ROW_CLASS = 'wm-notification-row';
/** Date et heure après l'âge, montrées au survol de la ligne. */
export const DATE_CLASS = 'wm-notification-date';
/** Ligne avec des boutons : son lien (ou bouton) est étalé dessous, sans contenu (`OPENER_CLASS`). */
export const ACTION_ROW_CLASS = 'wm-notification-action-row';
export const OPENER_CLASS = 'wm-notification-opener';
/** Boutons de la ligne, au-dessus de son lien. */
export const ACTIONS_CLASS = 'wm-notification-actions';
const WIDTH = 460;
const HEIGHT = 550;
/** Écart avec la cloche et marge minimale avec les bords de l'écran, comme la liste du site. */
const GAP = 8;

/** Cloche entre l'engrenage et le solde : petit rond gris ghost, pastille rouge du nombre de non lues. */
export function Bell({ store, onToggle }: { readonly store: CenterStore; readonly onToggle: (bell: HTMLElement) => void }) {
  const { unread, anchor } = useCenter(store);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={button}
      type="button"
      class={`${buttonClass('round', { fill: 'ghost', size: 'sm' })} ${BELL_CLASS}`}
      aria-label="Notifications"
      title="Notifications"
      aria-expanded={anchor !== undefined && anchor === button.current}
      onClick={() => button.current && onToggle(button.current)}
    >
      <Icon name="bell" size={18} />
      {unread > 0 && <span class={siteClass.notificationCount}>{unread > 9 ? '9+' : unread}</span>}
    </button>
  );
}

interface Handlers {
  readonly onOpen: (entry: Entry) => void;
  /** Ouverte par le navigateur dans un autre onglet (Ctrl, Maj, clic du milieu) : seulement marquée lue. */
  readonly onOpenElsewhere: (entry: Entry) => void;
  /** Ajoute ou retire la carte de la liste de souhaits, selon son état. */
  readonly onWish: (cardId: string) => void;
}

interface PanelProps extends Handlers {
  readonly store: CenterStore;
  readonly onMarkAll: () => void;
  readonly onClose: () => void;
}

interface Place {
  readonly top: number;
  readonly left: number;
  readonly width: number;
}

/** Sous la cloche, calée à droite de l'écran si elle déborderait (calcul du site, 460 × 550 au lieu de 320 × 384). */
function placeUnder(anchor: HTMLElement): Place {
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(WIDTH, window.innerWidth - 2 * GAP);
  let left = rect.left;
  if (left + width > window.innerWidth - GAP) left = window.innerWidth - GAP - width;
  return { top: rect.bottom + GAP, left: Math.max(GAP, left), width };
}

/** Liste des notifications (site et script mêlés), ouverte sous la cloche cliquée. */
export function Panel({ store, onMarkAll, onClose, ...handlers }: PanelProps) {
  const { entries, unread, anchor, marking, removed, wishing } = useCenter(store);
  const frame = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place>();
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!anchor) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), AGE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [anchor]);

  useLayoutEffect(() => {
    if (!anchor) return;
    const update = () => setPlace(placeUnder(anchor));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;
    const outside = (event: MouseEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (frame.current?.contains(target) || (target instanceof Element && target.closest(`.${BELL_CLASS}`))) return;
      onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [anchor, onClose]);

  if (!anchor || !place) return null;
  return (
    <div
      ref={frame}
      class={`${siteClass.notificationsPanel} wm-notifications-panel`}
      role="dialog"
      aria-label="Notifications"
      style={{
        top: `${place.top}px`,
        left: `${place.left}px`,
        width: `${place.width}px`,
        height: `min(${HEIGHT}px, calc(100dvh - ${place.top + GAP}px))`,
      }}
    >
      <div class={siteClass.notificationsHead}>
        <span class={siteClass.notificationsTitle}>Notifications</span>
        <button
          type="button"
          class={buttonClass('standard', { size: 'sm' })}
          disabled={unread === 0 || marking}
          aria-busy={marking}
          onClick={onMarkAll}
        >
          <Icon name="check-check" size={14} busy={marking} />
          Tout marquer comme lu
        </button>
      </div>
      <div class={siteClass.notificationsList}>
        {entries.length === 0 ? (
          <p class={siteClass.notificationsEmpty}>Aucune notification</p>
        ) : (
          entries.map((entry) => {
            const card = entry.wishlistCard;
            const wish = card === undefined ? undefined : { wished: wishedIn(removed, card), busy: wishing.has(card) };
            return <Row key={entry.key} entry={entry} now={now} wish={wish} {...handlers} />;
          })
        )}
      </div>
    </div>
  );
}

interface RowProps extends Handlers {
  readonly entry: Entry;
  readonly now: number;
  /** Carte de ma liste de souhaits : bouton pour l'en retirer (ou l'y remettre). */
  readonly wish: { readonly wished: boolean; readonly busy: boolean } | undefined;
}

/** Une notification. Avec des boutons, son lien est étalé sous la ligne : un bouton ne se met pas dans un lien. */
function Row({ entry, now, wish, onOpen, onOpenElsewhere, onWish }: RowProps) {
  const className = `${siteClass.notificationRow} ${ROW_CLASS}${entry.read ? '' : ` ${siteClass.notificationUnread}`}`;
  const card = entry.wishlistCard;
  const actions = wish && card !== undefined && (
    <div class={ACTIONS_CLASS}>
      <button
        type="button"
        class={buttonClass('standard', { size: 'sm', tone: 'accent', fill: wish.wished ? 'solid' : 'outline' })}
        disabled={wish.busy}
        aria-busy={wish.busy}
        onClick={() => onWish(card)}
      >
        <Icon name="bookmark" size={14} busy={wish.busy} />
        {wish.wished ? 'Retirer de la liste de souhaits' : 'Ajouter à la liste de souhaits'}
      </button>
    </div>
  );
  const content = (
    <>
      <Icon name={entry.icon} size={20} class={siteClass.notificationIcon} />
      <div class={siteClass.notificationBody}>
        <p class={siteClass.notificationLabel}>{entry.label}</p>
        <p class={entry.long ? siteClass.notificationLongText : siteClass.notificationText}>{entry.text}</p>
        <p class={siteClass.notificationDate}>
          {notificationAge(entry.time, now)}
          <span class={DATE_CLASS}> ({formatNotificationDate(new Date(entry.time))})</span>
        </p>
        {actions}
      </div>
      {!entry.read && <div class={siteClass.notificationDot} />}
    </>
  );
  if (!actions) {
    return (
      <Opener entry={entry} class={className} onOpen={onOpen} onOpenElsewhere={onOpenElsewhere}>
        {content}
      </Opener>
    );
  }
  return (
    <div class={`${className} ${ACTION_ROW_CLASS}`}>
      <Opener entry={entry} class={OPENER_CLASS} label={`${entry.label} : ${entry.text}`} onOpen={onOpen} onOpenElsewhere={onOpenElsewhere} />
      {content}
    </div>
  );
}

interface OpenerProps extends Pick<Handlers, 'onOpen' | 'onOpenElsewhere'> {
  readonly entry: Entry;
  readonly class: string;
  /** Nom d'un lien sans contenu. */
  readonly label?: string;
  readonly children?: ComponentChildren;
}

/**
 * Ouvre la notification. Avec une page, c'est un vrai lien : Ctrl, Maj ou le clic du milieu l'ouvrent dans un autre
 * onglet par le navigateur ; un clic simple garde la navigation du site.
 */
function Opener({ entry, class: className, label, children, onOpen, onOpenElsewhere }: OpenerProps) {
  if (entry.href === undefined) {
    return (
      <button type="button" class={className} aria-label={label} onClick={() => onOpen(entry)}>
        {children}
      </button>
    );
  }
  return (
    <a
      href={entry.href}
      class={className}
      aria-label={label}
      onClick={(event) => {
        if (!isPlainClick(event)) {
          onOpenElsewhere(entry);
          return;
        }
        event.preventDefault();
        onOpen(entry);
      }}
      onAuxClick={(event) => {
        if (event.button === 1) onOpenElsewhere(entry);
      }}
    >
      {children}
    </a>
  );
}
