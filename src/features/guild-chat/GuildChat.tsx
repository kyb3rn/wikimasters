import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { EMBEDDED_CLASS } from '@/core/dom';
import {
  fetchGuildChat,
  fetchGuildSender,
  GUILD_MESSAGE_MAX_LENGTH,
  parseGuildMessage,
  sendGuildMessage,
  SiteApiError,
  siteErrorText,
  type GuildMessage,
  type Player,
} from '@/site/api';
import { CHAT_ROW_DATA, GUILD_CHAT_CLASS } from '@/site/dms';
import { forgetMyGuild, type MyGuild } from '@/site/guild';
import { openRealtimeChannel } from '@/site/realtime';
import { buttonClass } from '@/ui/button';
import { CloseButton, LoadError } from '@/ui/controls';
import { Icon } from '@/ui/icons';
import { leaveSmoothly, useBackdropGuard } from '@/ui/modal';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';
import { toast } from '@/ui/toast';
import { collectSenders, groupByDay, mergeMessages, timeLabel } from './messages';

const BACKDROP = 'wm-guild-chat-backdrop';

/* Fond des modales du site (celui que site-modals leur donne) ; posée sur /dms, la conversation n'en a pas. */
export const GUILD_CHAT_CSS = `
.${BACKDROP} { background: ${tokens.backdrop}; -webkit-backdrop-filter: ${tokens.backdropBlur}; backdrop-filter: ${tokens.backdropBlur}; }
.${GUILD_CHAT_CLASS} input { height: ${tokens.fieldHeight}; }
`;

export interface GuildChatProps {
  readonly guild: MyGuild;
  /** Joueur connecté : ses messages à droite. */
  readonly me: string;
  readonly onClose: () => void;
}

type Load = 'loading' | 'ready' | 'error';

const initials = (username: string) => username.slice(0, 2).toUpperCase();

function Avatar({ sender, username, class: className }: { sender: Player | undefined; username: string; class: string }) {
  return (
    <div class={className}>
      {sender?.avatarUrl ? (
        <img
          alt={username}
          class={siteClass.chatAvatarImage}
          src={sender.avatarUrl}
          style={{ objectPosition: `${sender.avatarPosX}% ${sender.avatarPosY}%` }}
        />
      ) : (
        <span>{initials(username)}</span>
      )}
    </div>
  );
}

function Message({ message, own, sender }: { message: GuildMessage; own: boolean; sender: Player | undefined }) {
  if (message.type === 'event') {
    return (
      <div class={siteClass.chatNotice}>
        <span class={siteClass.chatNoticeText}>{message.content}</span>
      </div>
    );
  }
  const username = sender?.username ?? '?';
  const data = {
    [CHAT_ROW_DATA.id]: message.id,
    [CHAT_ROW_DATA.at]: String(Date.parse(message.createdAt)),
    [CHAT_ROW_DATA.sender]: message.senderId ?? 'inconnu',
    ...(sender ? { [CHAT_ROW_DATA.name]: sender.username } : {}),
  };
  return (
    <div class={siteClass.chatMessage} {...data}>
      {!own && (
        <div class={siteClass.chatName}>
          <div class={siteClass.chatSpacer} aria-hidden="true" />
          <span class={siteClass.chatNameText}>{username}</span>
        </div>
      )}
      <div class={`${siteClass.chatLine} ${own ? siteClass.chatLineOwn : siteClass.chatLineOther}`}>
        {!own && <Avatar sender={sender} username={username} class={siteClass.chatAvatar} />}
        <div class={`${siteClass.chatBubble} ${own ? siteClass.chatBubbleOwn : siteClass.chatBubbleOther}`}>{message.content}</div>
      </div>
      <div class={`${siteClass.chatTime} ${own ? siteClass.chatTimeOwn : siteClass.chatLineOther}`}>
        {!own && <div class={siteClass.chatSpacer} aria-hidden="true" />}
        <span class={siteClass.chatTimeText}>{timeLabel(message.createdAt)}</span>
      </div>
    </div>
  );
}

/**
 * Chat de la guilde au balisage d'une conversation privée du site (même fenêtre, mêmes messages) : dms-layout la pose
 * à droite de /dms, dms-groups groupe ses messages, player-links lie photos et pseudos. Le site ne la propose que sur
 * /guild : ici tout est à nous, avec ses routes et son canal temps réel (`guild-chat:<guilde>`), suivi tant qu'elle
 * est ouverte ; après une coupure, la liste est relue (messages manqués).
 */
export function GuildChat({ guild, me, onClose }: GuildChatProps) {
  const backdrop = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const senders = useRef(new Map<string, Player>());
  const [messages, setMessages] = useState<GuildMessage[]>([]);
  const [load, setLoad] = useState<Load>('loading');
  const [retrying, setRetrying] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  useBackdropGuard(backdrop);

  const add = useCallback((incoming: readonly GuildMessage[]) => {
    collectSenders(incoming, senders.current);
    setMessages((known) => mergeMessages(known, incoming));
  }, []);

  /** `silent` : relecture après une coupure, sans roue ni erreur affichée. */
  const read = useCallback(
    async (silent: boolean): Promise<void> => {
      try {
        add(await fetchGuildChat());
        setLoad('ready');
      } catch (error) {
        // Refusé : peut-être plus dans cette guilde, à revérifier au prochain passage.
        if (error instanceof SiteApiError && (error.status === 403 || error.status === 404)) forgetMyGuild();
        if (!silent) setLoad((current) => (current === 'ready' ? current : 'error'));
      }
    },
    [add],
  );

  useEffect(() => {
    const controller = new AbortController();
    void read(false);
    let joinedOnce = false;
    openRealtimeChannel({
      topic: `guild-chat:${guild.id}`,
      changes: [{ event: 'INSERT', schema: 'public', table: 'guild_messages', filter: `guild_id=eq.${guild.id}` }],
      onChange: ({ record }) => {
        const message = parseGuildMessage(record);
        if (!message) return;
        const known = message.senderId ? senders.current.get(message.senderId) : undefined;
        add([known && !message.sender ? { ...message, sender: known } : message]);
        if (!known && !message.sender && message.senderId && message.type !== 'event') {
          fetchGuildSender(message.senderId)
            .then((sender) => sender && !controller.signal.aborted && add([{ ...message, sender }]))
            .catch(() => undefined);
        }
      },
      onStatus: (status) => {
        if (status !== 'joined') return;
        if (joinedOnce) void read(true);
        joinedOnce = true;
      },
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [guild.id, read, add]);

  // Fondu de sortie comme les modales (pas posée sur /dms : la conversation suivante prend sa place).
  useLayoutEffect(
    () => () => {
      const element = backdrop.current;
      const container = element?.parentElement;
      if (!element?.isConnected || !container?.parentNode || element.classList.contains(EMBEDDED_CLASS)) return;
      leaveSmoothly(element, { parent: container.parentNode, before: container.nextSibling, frame: frame.current ?? undefined, own: true });
    },
    [],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || backdrop.current?.classList.contains(EMBEDDED_CLASS)) return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // Comme le site : en bas à l'ouverture, puis en douceur à chaque nouveau message.
  const shown = useRef(false);
  useLayoutEffect(() => {
    const element = list.current;
    if (!element || load !== 'ready') return;
    element.scrollTo({ top: element.scrollHeight, behavior: shown.current ? 'smooth' : 'auto' });
    if (!shown.current) input.current?.focus();
    shown.current = true;
  }, [messages, load]);

  async function retry(): Promise<void> {
    setRetrying(true);
    try {
      await read(false);
    } finally {
      setRetrying(false);
    }
  }

  async function send(): Promise<void> {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    try {
      add([await sendGuildMessage(content)]);
    } catch (error) {
      setText(content);
      toast.error(siteErrorText(error), { title: 'Message non envoyé' });
    } finally {
      setSending(false);
      input.current?.focus();
    }
  }

  return (
    <div
      ref={backdrop}
      class={`${siteClass.chatOverlay} ${BACKDROP}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={frame} class={`${siteClass.chatFrame} ${GUILD_CHAT_CLASS}`} role="dialog" aria-label={`Chat de ${guild.name}`}>
        <div class={siteClass.chatHeader}>
          <div class={siteClass.chatHeaderAvatar}>
            <Icon name="castle" size={18} />
          </div>
          <div class={siteClass.chatHeaderText}>
            <p class={siteClass.chatHeaderName}>{guild.name}</p>
            <p class={siteClass.dmsRowText}>Chat de la guilde</p>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <div ref={list} class={siteClass.chatList}>
          {load === 'loading' ? (
            <div class={siteClass.chatCenter}>
              <Icon name="spinner" size={24} />
            </div>
          ) : load === 'error' ? (
            <div class={siteClass.chatCenter}>
              <LoadError message="Le chat de la guilde n'a pas pu se charger." busy={retrying} onRetry={() => void retry()} />
            </div>
          ) : messages.length === 0 ? (
            <div class={siteClass.chatEmpty}>
              <Icon name="message" size={40} class={siteClass.chatEmptyIcon} />
              <p class={siteClass.chatEmptyText}>Soyez le premier à écrire dans le chat de la guilde !</p>
            </div>
          ) : (
            groupByDay(messages).map((day) => (
              <div key={day.label}>
                <div class={siteClass.chatDay}>
                  <div class={siteClass.chatDayLine} />
                  <span class={siteClass.chatDayLabel}>{day.label}</span>
                  <div class={siteClass.chatDayLine} />
                </div>
                {day.messages.map((message) => {
                  const sender = message.sender ?? (message.senderId ? senders.current.get(message.senderId) : undefined);
                  // Auteur connu après coup (temps réel) : ligne recréée, pour que watchDom la voie (il ne suit ni les
                  // textes ni nos attributs) et que dms-groups, player-links la relisent.
                  return <Message key={`${message.id}:${sender?.id ?? ''}`} message={message} own={message.senderId === me} sender={sender} />;
                })}
              </div>
            ))
          )}
        </div>
        <div class={siteClass.chatBar}>
          <input
            ref={input}
            type="text"
            class={siteClass.chatInput}
            value={text}
            maxLength={GUILD_MESSAGE_MAX_LENGTH}
            placeholder="Message à la guilde…"
            disabled={load !== 'ready'}
            onInput={(event) => setText(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey) return;
              event.preventDefault();
              void send();
            }}
          />
          <button
            type="button"
            class={buttonClass('square', { tone: 'accent', fill: 'solid', size: 'md' })}
            aria-label="Envoyer"
            aria-busy={sending || undefined}
            disabled={sending || load !== 'ready' || text.trim() === ''}
            onClick={() => void send()}
          >
            <Icon name="send" busy={sending} size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
